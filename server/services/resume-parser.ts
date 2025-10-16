import * as pdfParse from 'pdf-parse';
import { promises as fs } from 'fs';

export interface ResumeData {
  fullText: string;
  name?: string;
  email?: string;
  phone?: string;
  skills?: string[];
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
        skills: this.extractSkills(fullText),
        experience: this.extractExperience(fullText),
        education: this.extractEducation(fullText),
        licenses: this.extractLicenses(fullText),
      };
    } catch (error) {
      console.error('Error parsing resume:', error);
      throw new Error('Failed to parse resume');
    }
  }

  async parseResumeFromBuffer(buffer: Buffer): Promise<ResumeData> {
    try {
      const data = await (pdfParse as any).default(buffer);
      
      const fullText = data.text;
      
      return {
        fullText,
        name: this.extractName(fullText),
        email: this.extractEmail(fullText),
        phone: this.extractPhone(fullText),
        skills: this.extractSkills(fullText),
        experience: this.extractExperience(fullText),
        education: this.extractEducation(fullText),
        licenses: this.extractLicenses(fullText),
      };
    } catch (error) {
      console.error('Error parsing resume from buffer:', error);
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

  private extractSkills(text: string): string[] {
    const skillKeywords = ['skills', 'technologies', 'proficient', 'expertise', 'competencies', 'technical skills', 'soft skills'];
    const skills: string[] = [];
    
    // Common programming/technical skills to look for
    const commonSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'React', 'Angular', 'Vue', 'Node.js',
      'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
      'Git', 'CI/CD', 'Agile', 'Scrum', 'REST', 'API', 'HTML', 'CSS', 'Sass', 'Bootstrap',
      'Excel', 'PowerPoint', 'Word', 'Outlook', 'Salesforce', 'HubSpot', 'Zendesk',
      'Project Management', 'Leadership', 'Communication', 'Problem Solving', 'Team Management',
      'Customer Service', 'Sales', 'Marketing', 'Analytics', 'Data Analysis'
    ];
    
    const lowerText = text.toLowerCase();
    
    // First, try to find a dedicated skills section
    for (const keyword of skillKeywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        const section = text.substring(index, Math.min(index + 500, text.length));
        const lines = section.split('\n').filter(line => line.trim());
        
        // Extract skills from the next few lines after the keyword
        if (lines.length > 1) {
          for (let i = 1; i < Math.min(lines.length, 6); i++) {
            const line = lines[i];
            // Split by common delimiters
            const potentialSkills = line.split(/[,;•·|]/).map(s => s.trim());
            for (const skill of potentialSkills) {
              if (skill && skill.length > 2 && skill.length < 50 && !skills.includes(skill)) {
                skills.push(skill);
              }
            }
          }
        }
        
        if (skills.length > 0) {
          break;
        }
      }
    }
    
    // Also scan the entire text for common skills
    for (const skill of commonSkills) {
      if (text.includes(skill) && !skills.some(s => s.toLowerCase() === skill.toLowerCase())) {
        skills.push(skill);
      }
    }
    
    // Limit to max 20 skills
    return skills.slice(0, 20);
  }
}

export const resumeParser = new ResumeParserService();
