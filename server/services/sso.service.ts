import { db } from "../db";
import { ssoConfigurations, users, enterpriseAuditLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import * as saml2 from "saml2-js";
import crypto from "crypto";
import { z } from "zod";

// Validation schemas
const configureSSOSchema = z.object({
  workspaceId: z.string(),
  providerType: z.enum(["saml", "google", "microsoft", "okta", "onelogin", "ping", "custom"]),
  providerName: z.string(),
  entityId: z.string().optional(),
  ssoUrl: z.string().url().optional(),
  certificateData: z.string().optional(),
  metadataUrl: z.string().url().optional(),
  samlMetadata: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  allowFallbackAuth: z.boolean().default(true),
  autoProvisionUsers: z.boolean().default(false),
  defaultRole: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
});

class SSOService {
  private strategies: Map<string, passport.Strategy> = new Map();
  
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
  
  // Configure SSO for a workspace
  async configureSSOProvider(data: z.infer<typeof configureSSOSchema>) {
    const validated = configureSSOSchema.parse(data);
    
    // Encrypt sensitive data
    if (validated.clientSecret) {
      validated.clientSecret = this.encrypt(validated.clientSecret);
    }
    if (validated.certificateData) {
      validated.certificateData = this.encrypt(validated.certificateData);
    }
    
    // Check if SSO config already exists
    const existing = await db.select()
      .from(ssoConfigurations)
      .where(and(
        eq(ssoConfigurations.workspaceId, validated.workspaceId),
        eq(ssoConfigurations.providerType, validated.providerType)
      ))
      .limit(1);
    
    let configId: string;
    
    if (existing.length > 0) {
      // Update existing configuration
      await db.update(ssoConfigurations)
        .set({
          ...validated,
          updatedAt: new Date(),
        })
        .where(eq(ssoConfigurations.id, existing[0].id));
      
      configId = existing[0].id;
    } else {
      // Create new configuration
      const result = await db.insert(ssoConfigurations)
        .values({
          ...validated,
          enabled: false, // Start disabled
        })
        .returning();
      
      configId = result[0].id;
    }
    
    // Reinitialize strategy if enabled
    const config = await this.getConfiguration(validated.workspaceId, validated.providerType);
    if (config?.enabled) {
      await this.initializeStrategy(config);
    }
    
    // Log configuration change
    await this.logAuditEvent({
      workspaceId: validated.workspaceId,
      action: existing.length > 0 ? 'sso_config_changed' : 'sso_config_changed',
      actorId: 'system',
      resourceType: 'sso_configuration',
      resourceId: configId,
      details: {
        providerType: validated.providerType,
        providerName: validated.providerName,
      },
      success: true,
    });
    
    return configId;
  }
  
  // Enable/disable SSO for a workspace
  async toggleSSO(workspaceId: string, providerType: string, enabled: boolean) {
    const config = await this.getConfiguration(workspaceId, providerType);
    
    if (!config) {
      throw new Error('SSO configuration not found');
    }
    
    await db.update(ssoConfigurations)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(ssoConfigurations.id, config.id));
    
    if (enabled) {
      await this.initializeStrategy(config);
    } else {
      this.removeStrategy(config.id);
    }
    
    // Log status change
    await this.logAuditEvent({
      workspaceId,
      action: 'sso_config_changed',
      actorId: 'system',
      resourceType: 'sso_configuration',
      resourceId: config.id,
      details: { enabled },
      success: true,
    });
    
    return { success: true, enabled };
  }
  
  // Get SSO configuration
  async getConfiguration(workspaceId: string, providerType: string) {
    const configs = await db.select()
      .from(ssoConfigurations)
      .where(and(
        eq(ssoConfigurations.workspaceId, workspaceId),
        eq(ssoConfigurations.providerType, providerType)
      ))
      .limit(1);
    
    if (configs.length === 0) return null;
    
    const config = configs[0];
    
    // Don't return encrypted values
    if (config.clientSecret) {
      config.clientSecret = '[ENCRYPTED]';
    }
    if (config.certificateData) {
      config.certificateData = '[ENCRYPTED]';
    }
    
    return config;
  }
  
  // Get all SSO configurations for a workspace
  async getWorkspaceConfigurations(workspaceId: string) {
    const configs = await db.select()
      .from(ssoConfigurations)
      .where(eq(ssoConfigurations.workspaceId, workspaceId));
    
    // Hide encrypted values
    return configs.map(config => {
      if (config.clientSecret) {
        config.clientSecret = '[ENCRYPTED]';
      }
      if (config.certificateData) {
        config.certificateData = '[ENCRYPTED]';
      }
      return config;
    });
  }
  
  // Initialize SAML strategy
  private async initializeStrategy(config: any) {
    if (config.providerType === 'saml') {
      const decryptedCert = config.certificateData ? this.decrypt(config.certificateData) : undefined;
      
      const samlStrategy = new SamlStrategy({
        entryPoint: config.ssoUrl,
        issuer: config.entityId,
        cert: decryptedCert,
        callbackUrl: `${process.env.APP_BASE_URL}/api/auth/sso/callback`,
        passReqToCallback: true,
      }, async (req: any, profile: any, done: any) => {
        try {
          // Handle SAML authentication callback
          const user = await this.findOrCreateUser(profile, config);
          done(null, user);
        } catch (error) {
          done(error);
        }
      });
      
      passport.use(`saml-${config.id}`, samlStrategy);
      this.strategies.set(config.id, samlStrategy);
    }
    
    // Additional provider implementations (Google, Microsoft, etc.) would go here
  }
  
  // Remove strategy
  private removeStrategy(configId: string) {
    if (this.strategies.has(configId)) {
      this.strategies.delete(configId);
      passport.unuse(`saml-${configId}`);
    }
  }
  
  // Find or create user from SSO profile
  private async findOrCreateUser(profile: any, config: any) {
    const email = profile.email || profile.nameID || profile.id;
    
    if (!email) {
      throw new Error('No email found in SSO profile');
    }
    
    // Check allowed domains
    if (config.allowedDomains && config.allowedDomains.length > 0) {
      const domain = email.split('@')[1];
      if (!config.allowedDomains.includes(domain)) {
        throw new Error('Email domain not allowed');
      }
    }
    
    // Find existing user
    let user = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (user.length > 0) {
      // Update last SSO login
      await db.update(users)
        .set({ 
          lastLogin: new Date(),
        })
        .where(eq(users.id, user[0].id));
      
      return user[0];
    }
    
    // Auto-provision user if enabled
    if (config.autoProvisionUsers) {
      const newUser = await db.insert(users)
        .values({
          email,
          firstName: profile.firstName || profile.givenName || '',
          lastName: profile.lastName || profile.familyName || '',
          isAdmin: config.defaultRole === 'admin',
        })
        .returning();
      
      // Log user creation
      await this.logAuditEvent({
        workspaceId: config.workspaceId,
        action: 'user_created',
        actorId: 'sso-provisioning',
        resourceType: 'user',
        resourceId: newUser[0].id,
        details: { 
          email,
          ssoProvider: config.providerType,
          autoProvisioned: true,
        },
        success: true,
      });
      
      return newUser[0];
    }
    
    throw new Error('User not found and auto-provisioning is disabled');
  }
  
  // Validate SAML response
  async validateSAMLResponse(samlResponse: string, config: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const decryptedCert = config.certificateData ? this.decrypt(config.certificateData) : undefined;
      
      const sp = new saml2.ServiceProvider({
        entity_id: config.entityId,
        assert_endpoint: `${process.env.APP_BASE_URL}/api/auth/sso/callback`,
      });
      
      const idp = new saml2.IdentityProvider({
        sso_login_url: config.ssoUrl,
        certificates: decryptedCert ? [decryptedCert] : [],
      });
      
      sp.post_assert(idp, { request_body: { SAMLResponse: samlResponse } }, (err: any, samlAssert: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(samlAssert.user);
        }
      });
    });
  }
  
  // SCIM user provisioning
  async scimProvisionUser(workspaceId: string, userData: any) {
    const config = await db.select()
      .from(ssoConfigurations)
      .where(and(
        eq(ssoConfigurations.workspaceId, workspaceId),
        eq(ssoConfigurations.scimEnabled, true)
      ))
      .limit(1);
    
    if (config.length === 0) {
      throw new Error('SCIM not enabled for workspace');
    }
    
    // Validate SCIM API key
    // This would typically check against the encrypted key in config
    
    // Create or update user
    const email = userData.emails?.[0]?.value;
    if (!email) {
      throw new Error('Email required for SCIM provisioning');
    }
    
    const existing = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing user
      await db.update(users)
        .set({
          firstName: userData.name?.givenName,
          lastName: userData.name?.familyName,
          isActive: userData.active !== false,
        })
        .where(eq(users.id, existing[0].id));
      
      return existing[0];
    } else {
      // Create new user
      const newUser = await db.insert(users)
        .values({
          email,
          firstName: userData.name?.givenName || '',
          lastName: userData.name?.familyName || '',
          isActive: userData.active !== false,
          isAdmin: false,
        })
        .returning();
      
      return newUser[0];
    }
  }
  
  // SCIM user deprovisioning
  async scimDeprovisionUser(workspaceId: string, userId: string) {
    const config = await db.select()
      .from(ssoConfigurations)
      .where(and(
        eq(ssoConfigurations.workspaceId, workspaceId),
        eq(ssoConfigurations.scimEnabled, true)
      ))
      .limit(1);
    
    if (config.length === 0) {
      throw new Error('SCIM not enabled for workspace');
    }
    
    // Soft delete or deactivate user
    await db.update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId));
    
    // Log deprovisioning
    await this.logAuditEvent({
      workspaceId,
      action: 'user_deleted',
      actorId: 'scim-deprovisioning',
      resourceType: 'user',
      resourceId: userId,
      details: { scimDeprovisioned: true },
      success: true,
    });
    
    return { success: true };
  }
  
  // Initialize SSO middleware
  initializeMiddleware() {
    // Load all enabled SSO configurations on startup
    this.loadEnabledConfigurations();
  }
  
  // Load enabled SSO configurations
  private async loadEnabledConfigurations() {
    const configs = await db.select()
      .from(ssoConfigurations)
      .where(eq(ssoConfigurations.enabled, true));
    
    for (const config of configs) {
      try {
        await this.initializeStrategy(config);
        console.log(`Initialized SSO strategy for ${config.providerType} in workspace ${config.workspaceId}`);
      } catch (error) {
        console.error(`Failed to initialize SSO strategy for ${config.id}:`, error);
      }
    }
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

export const ssoService = new SSOService();