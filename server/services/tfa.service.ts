import { db } from "../db";
import { tfaSettings, users, enterpriseAuditLogs, trustedDevices } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import twilio from "twilio";

// Validation schemas
const enableTOTPSchema = z.object({
  userId: z.string(),
  secret: z.string().optional(), // If not provided, generate new
});

const verifyTOTPSchema = z.object({
  userId: z.string(),
  token: z.string().length(6),
});

const enableSMSSchema = z.object({
  userId: z.string(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/), // E.164 format
});

const verifySMSSchema = z.object({
  userId: z.string(),
  code: z.string().length(6),
});

class TFAService {
  private twilioClient: twilio.Twilio | null = null;
  private pendingSMSCodes: Map<string, { code: string; expires: Date }> = new Map();
  
  constructor() {
    // Initialize Twilio if credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }
  
  // Encrypt sensitive data
  private encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }
  
  // Decrypt sensitive data
  private decrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = textParts.join(':');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  // Generate TOTP secret and QR code
  async generateTOTPSecret(userId: string, userEmail: string) {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${process.env.APP_NAME || 'iFast Broker'} (${userEmail})`,
      length: 32,
    });
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    
    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
    };
  }
  
  // Enable TOTP for a user
  async enableTOTP(data: z.infer<typeof enableTOTPSchema>) {
    const validated = enableTOTPSchema.parse(data);
    
    // Get user
    const user = await db.select()
      .from(users)
      .where(eq(users.id, validated.userId))
      .limit(1);
    
    if (user.length === 0) {
      throw new Error('User not found');
    }
    
    // Generate secret if not provided
    let secret = validated.secret;
    if (!secret) {
      const generated = await this.generateTOTPSecret(validated.userId, user[0].email);
      secret = generated.secret;
    }
    
    // Encrypt secret
    const encryptedSecret = this.encrypt(secret);
    
    // Check if TFA settings exist
    const existing = await db.select()
      .from(tfaSettings)
      .where(eq(tfaSettings.userId, validated.userId))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing settings
      await db.update(tfaSettings)
        .set({
          totpSecret: encryptedSecret,
          totpEnabled: true,
          totpVerified: false,
          updatedAt: new Date(),
        })
        .where(eq(tfaSettings.userId, validated.userId));
    } else {
      // Create new settings
      await db.insert(tfaSettings)
        .values({
          userId: validated.userId,
          totpSecret: encryptedSecret,
          totpEnabled: true,
          totpVerified: false,
        });
    }
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    await this.storeBackupCodes(validated.userId, backupCodes);
    
    // Log activation
    await this.logAuditEvent({
      workspaceId: 'system',
      action: '2fa_enabled',
      actorId: validated.userId,
      resourceType: 'user',
      resourceId: validated.userId,
      details: { method: 'totp' },
      success: true,
    });
    
    // Return QR code if secret was generated
    if (!validated.secret) {
      const generated = await this.generateTOTPSecret(validated.userId, user[0].email);
      return {
        qrCode: generated.qrCode,
        manualEntryKey: generated.manualEntryKey,
        backupCodes,
      };
    }
    
    return { backupCodes };
  }
  
  // Verify TOTP token
  async verifyTOTP(data: z.infer<typeof verifyTOTPSchema>) {
    const validated = verifyTOTPSchema.parse(data);
    
    // Get TFA settings
    const settings = await db.select()
      .from(tfaSettings)
      .where(eq(tfaSettings.userId, validated.userId))
      .limit(1);
    
    if (settings.length === 0 || !settings[0].totpEnabled || !settings[0].totpSecret) {
      throw new Error('TOTP not enabled for user');
    }
    
    // Decrypt secret
    const secret = this.decrypt(settings[0].totpSecret);
    
    // Verify token
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: validated.token,
      window: 2, // Allow 2 time steps tolerance
    });
    
    if (!isValid) {
      // Check backup codes
      const backupValid = await this.verifyBackupCode(validated.userId, validated.token);
      if (!backupValid) {
        // Log failed attempt
        await this.logAuditEvent({
          workspaceId: 'system',
          action: '2fa_failed',
          actorId: validated.userId,
          resourceType: 'user',
          resourceId: validated.userId,
          details: { method: 'totp' },
          success: false,
        });
        
        return { valid: false };
      }
      
      return { valid: true, backupCodeUsed: true };
    }
    
    // Mark as verified if first time
    if (!settings[0].totpVerified) {
      await db.update(tfaSettings)
        .set({
          totpVerified: true,
          lastVerified: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tfaSettings.userId, validated.userId));
    } else {
      // Update last verified time
      await db.update(tfaSettings)
        .set({
          lastVerified: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tfaSettings.userId, validated.userId));
    }
    
    // Log successful verification
    await this.logAuditEvent({
      workspaceId: 'system',
      action: '2fa_verified',
      actorId: validated.userId,
      resourceType: 'user',
      resourceId: validated.userId,
      details: { method: 'totp' },
      success: true,
    });
    
    return { valid: true };
  }
  
  // Enable SMS 2FA
  async enableSMS(data: z.infer<typeof enableSMSSchema>) {
    const validated = enableSMSSchema.parse(data);
    
    if (!this.twilioClient) {
      throw new Error('SMS service not configured');
    }
    
    // Encrypt phone number
    const encryptedPhone = this.encrypt(validated.phoneNumber);
    
    // Check if TFA settings exist
    const existing = await db.select()
      .from(tfaSettings)
      .where(eq(tfaSettings.userId, validated.userId))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing settings
      await db.update(tfaSettings)
        .set({
          smsPhoneNumber: encryptedPhone,
          smsEnabled: true,
          smsVerified: false,
          updatedAt: new Date(),
        })
        .where(eq(tfaSettings.userId, validated.userId));
    } else {
      // Create new settings
      await db.insert(tfaSettings)
        .values({
          userId: validated.userId,
          smsPhoneNumber: encryptedPhone,
          smsEnabled: true,
          smsVerified: false,
        });
    }
    
    // Send verification code
    await this.sendSMSCode(validated.userId, validated.phoneNumber);
    
    // Log activation
    await this.logAuditEvent({
      workspaceId: 'system',
      action: '2fa_enabled',
      actorId: validated.userId,
      resourceType: 'user',
      resourceId: validated.userId,
      details: { method: 'sms' },
      success: true,
    });
    
    return { success: true, message: 'Verification code sent' };
  }
  
  // Send SMS verification code
  async sendSMSCode(userId: string, phoneNumber?: string) {
    if (!this.twilioClient) {
      throw new Error('SMS service not configured');
    }
    
    // Get phone number if not provided
    if (!phoneNumber) {
      const settings = await db.select()
        .from(tfaSettings)
        .where(eq(tfaSettings.userId, userId))
        .limit(1);
      
      if (settings.length === 0 || !settings[0].smsPhoneNumber) {
        throw new Error('SMS not enabled for user');
      }
      
      phoneNumber = this.decrypt(settings[0].smsPhoneNumber);
    }
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code temporarily (expires in 10 minutes)
    this.pendingSMSCodes.set(userId, {
      code,
      expires: new Date(Date.now() + 10 * 60 * 1000),
    });
    
    // Send SMS
    try {
      await this.twilioClient.messages.create({
        body: `Your ${process.env.APP_NAME || 'iFast Broker'} verification code is: ${code}`,
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
      });
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw new Error('Failed to send verification code');
    }
    
    return { success: true };
  }
  
  // Verify SMS code
  async verifySMS(data: z.infer<typeof verifySMSSchema>) {
    const validated = verifySMSSchema.parse(data);
    
    // Check pending code
    const pending = this.pendingSMSCodes.get(validated.userId);
    
    if (!pending) {
      return { valid: false, message: 'No pending verification code' };
    }
    
    // Check expiration
    if (pending.expires < new Date()) {
      this.pendingSMSCodes.delete(validated.userId);
      return { valid: false, message: 'Verification code expired' };
    }
    
    // Verify code
    if (pending.code !== validated.code) {
      // Log failed attempt
      await this.logAuditEvent({
        workspaceId: 'system',
        action: '2fa_failed',
        actorId: validated.userId,
        resourceType: 'user',
        resourceId: validated.userId,
        details: { method: 'sms' },
        success: false,
      });
      
      return { valid: false, message: 'Invalid verification code' };
    }
    
    // Remove used code
    this.pendingSMSCodes.delete(validated.userId);
    
    // Mark as verified
    await db.update(tfaSettings)
      .set({
        smsVerified: true,
        lastVerified: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tfaSettings.userId, validated.userId));
    
    // Log successful verification
    await this.logAuditEvent({
      workspaceId: 'system',
      action: '2fa_verified',
      actorId: validated.userId,
      resourceType: 'user',
      resourceId: validated.userId,
      details: { method: 'sms' },
      success: true,
    });
    
    return { valid: true };
  }
  
  // Generate backup codes
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    
    return codes;
  }
  
  // Store backup codes
  private async storeBackupCodes(userId: string, codes: string[]) {
    // Hash codes before storing
    const hashedCodes = codes.map(code => bcrypt.hashSync(code, 10));
    const encryptedCodes = hashedCodes.map(code => this.encrypt(code));
    
    await db.update(tfaSettings)
      .set({
        recoveryCodes: encryptedCodes,
        recoveryCodesUsed: [],
        updatedAt: new Date(),
      })
      .where(eq(tfaSettings.userId, userId));
  }
  
  // Verify backup code
  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const settings = await db.select()
      .from(tfaSettings)
      .where(eq(tfaSettings.userId, userId))
      .limit(1);
    
    if (settings.length === 0 || !settings[0].recoveryCodes) {
      return false;
    }
    
    // Check if code was already used
    if (settings[0].recoveryCodesUsed?.includes(code)) {
      return false;
    }
    
    // Check each recovery code
    for (const encryptedHash of settings[0].recoveryCodes) {
      const hash = this.decrypt(encryptedHash);
      if (bcrypt.compareSync(code, hash)) {
        // Mark code as used
        await db.update(tfaSettings)
          .set({
            recoveryCodesUsed: [...(settings[0].recoveryCodesUsed || []), code],
            updatedAt: new Date(),
          })
          .where(eq(tfaSettings.userId, userId));
        
        return true;
      }
    }
    
    return false;
  }
  
  // Disable 2FA
  async disable2FA(userId: string, method: 'totp' | 'sms' | 'all') {
    const updates: any = { updatedAt: new Date() };
    
    if (method === 'totp' || method === 'all') {
      updates.totpEnabled = false;
      updates.totpSecret = null;
      updates.totpVerified = false;
    }
    
    if (method === 'sms' || method === 'all') {
      updates.smsEnabled = false;
      updates.smsPhoneNumber = null;
      updates.smsVerified = false;
    }
    
    if (method === 'all') {
      updates.recoveryCodes = [];
      updates.recoveryCodesUsed = [];
      updates.enforced = false;
    }
    
    await db.update(tfaSettings)
      .set(updates)
      .where(eq(tfaSettings.userId, userId));
    
    // Log deactivation
    await this.logAuditEvent({
      workspaceId: 'system',
      action: '2fa_disabled',
      actorId: userId,
      resourceType: 'user',
      resourceId: userId,
      details: { method },
      success: true,
    });
    
    return { success: true };
  }
  
  // Get 2FA status for user
  async get2FAStatus(userId: string) {
    const settings = await db.select()
      .from(tfaSettings)
      .where(eq(tfaSettings.userId, userId))
      .limit(1);
    
    if (settings.length === 0) {
      return {
        totpEnabled: false,
        smsEnabled: false,
        enforced: false,
        hasBackupCodes: false,
      };
    }
    
    const setting = settings[0];
    
    return {
      totpEnabled: setting.totpEnabled || false,
      totpVerified: setting.totpVerified || false,
      smsEnabled: setting.smsEnabled || false,
      smsVerified: setting.smsVerified || false,
      enforced: setting.enforced || false,
      hasBackupCodes: (setting.recoveryCodes?.length || 0) > 0,
      backupCodesRemaining: (setting.recoveryCodes?.length || 0) - (setting.recoveryCodesUsed?.length || 0),
      preferredMethod: setting.preferredMethod,
      lastVerified: setting.lastVerified,
    };
  }
  
  // Check if user needs 2FA
  async requires2FA(userId: string, workspaceId?: string): Promise<boolean> {
    // Check user-level enforcement
    const userSettings = await db.select()
      .from(tfaSettings)
      .where(eq(tfaSettings.userId, userId))
      .limit(1);
    
    if (userSettings.length > 0 && userSettings[0].enforced) {
      return true;
    }
    
    // Check if user is admin and admin 2FA is enforced
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (user.length > 0 && user[0].isAdmin && workspaceId) {
      // Check workspace security policy for admin 2FA requirement
      // This would query the security policies table
      // For now, return false as policies implementation is separate
    }
    
    return false;
  }
  
  // Register trusted device
  async registerTrustedDevice(userId: string, deviceInfo: any) {
    const deviceId = crypto.randomBytes(32).toString('hex');
    
    await db.insert(trustedDevices)
      .values({
        userId,
        deviceIdentifier: deviceId,
        deviceName: deviceInfo.deviceName || 'Unknown Device',
        deviceType: deviceInfo.deviceType || 'desktop',
        browserName: deviceInfo.browserName,
        browserVersion: deviceInfo.browserVersion,
        operatingSystem: deviceInfo.operatingSystem,
        ipAddress: deviceInfo.ipAddress,
        trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        lastUsed: new Date(),
      });
    
    return { deviceId };
  }
  
  // Verify trusted device
  async verifyTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
    const devices = await db.select()
      .from(trustedDevices)
      .where(and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.deviceIdentifier, deviceId)
      ))
      .limit(1);
    
    if (devices.length === 0) {
      return false;
    }
    
    const device = devices[0];
    
    // Check if trust has expired
    if (device.trustedUntil && device.trustedUntil < new Date()) {
      // Remove expired device
      await db.delete(trustedDevices)
        .where(eq(trustedDevices.id, device.id));
      return false;
    }
    
    // Update last used
    await db.update(trustedDevices)
      .set({ lastUsed: new Date() })
      .where(eq(trustedDevices.id, device.id));
    
    return true;
  }
  
  // Log audit event
  private async logAuditEvent(event: any) {
    try {
      await db.insert(enterpriseAuditLogs).values({
        ...event,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const tfaService = new TFAService();