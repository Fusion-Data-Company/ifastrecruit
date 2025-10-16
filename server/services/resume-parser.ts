import * as pdfParse from 'pdf-parse';
import { promises as fs } from 'fs';

export interface ResumeData {
  fullText: string;
  name?: string;
  email?: string;
  phone?: string;
  experience?: string[];
  education?: string[];
  licenses?: string[];
}

export class ResumeParserService {
  async parseResume(filePath: string): Promise<ResumeData> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await (pdfParse as any).default(dataBuffer);
      
      const fullText = data.text;
      
      return {
        fullText,
        name: this.extractName(fullText),
        email: this.extractEmail(fullText),
        phone: this.extractPhone(fullText),
        experience: this.extractExperience(fullText),
        education: this.extractEducation(fullText),
        licenses: this.extractLicenses(fullText),
      };
    } catch (error) {
      console.error('Error parsing resume:', error);
      throw new Error('Failed to parse resume');
    }
  }

  private extractName(text: string): string | undefined {
    const lines = text.split('\n').filter(line => line.trim());
    return lines[0]?.trim();
  }

  private extractEmail(text: string): string | undefined {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = text.match(emailRegex);
    return match ? match[0] : undefined;
  }

  private extractPhone(text: string): string | undefined {
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    const match = text.match(phoneRegex);
    return match ? match[0] : undefined;
  }

  private extractExperience(text: string): string[] {
    const experienceKeywords = ['experience', 'employment', 'work history', 'professional experience'];
    const experiences: string[] = [];
    
    const lowerText = text.toLowerCase();
    for (const keyword of experienceKeywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        const section = text.substring(index, index + 500);
        const lines = section.split('\n').filter(line => line.trim());
        experiences.push(...lines.slice(1, 5));
        break;
      }
    }
    
    return experiences;
  }

  private extractEducation(text: string): string[] {
    const educationKeywords = ['education', 'academic', 'degree', 'university', 'college'];
    const education: string[] = [];
    
    const lowerText = text.toLowerCase();
    for (const keyword of educationKeywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        const section = text.substring(index, index + 300);
        const lines = section.split('\n').filter(line => line.trim());
        education.push(...lines.slice(1, 3));
        break;
      }
    }
    
    return education;
  }

  private extractLicenses(text: string): string[] {
    const licenseKeywords = ['license', 'licensed', 'certification', 'certified'];
    const licenses: string[] = [];
    
    const lowerText = text.toLowerCase();
    for (const keyword of licenseKeywords) {
      if (lowerText.includes(keyword)) {
        const regex = new RegExp(`${keyword}[s]?:?\\s*([^\\n]+)`, 'gi');
        const matchesArray = Array.from(text.matchAll(regex));
        for (const match of matchesArray) {
          licenses.push(match[1].trim());
        }
      }
    }
    
    return licenses;
  }
}

export const resumeParser = new ResumeParserService();
