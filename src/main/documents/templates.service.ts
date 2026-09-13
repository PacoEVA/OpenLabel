import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { BUILT_IN_TEMPLATES, TemplateMetadata } from '../../core/templates/built-in-templates';
import { saveDocument, readDocumentFile } from './document.service';
import type { LabelDocument } from '../../core/schemas/label.schema';

export interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  isBuiltIn: boolean;
  dimensions: {
    width: number;
    height: number;
    unit: 'mm' | 'inch';
  };
}

export class TemplatesService {
  private userTemplatesDir: string;

  constructor(customUserTemplatesDir?: string) {
    if (customUserTemplatesDir) {
      this.userTemplatesDir = customUserTemplatesDir;
    } else {
      try {
        const userData = app.getPath('userData');
        this.userTemplatesDir = path.join(userData, 'templates');
      } catch {
        this.userTemplatesDir = path.join(process.cwd(), '.templates');
      }
    }
  }

  private async ensureDir(): Promise<void> {
    if (!fs.existsSync(this.userTemplatesDir)) {
      await fs.promises.mkdir(this.userTemplatesDir, { recursive: true });
    }
  }

  /**
   * Lists all available templates (built-in read-only templates + user saved templates).
   */
  public async listTemplates(): Promise<{
    builtIn: TemplateSummary[];
    user: TemplateSummary[];
  }> {
    const builtInSummaries: TemplateSummary[] = BUILT_IN_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      isBuiltIn: true,
      dimensions: {
        width: t.document.dimensions.width,
        height: t.document.dimensions.height,
        unit: t.document.dimensions.unit,
      },
    }));

    const userSummaries: TemplateSummary[] = [];
    try {
      if (fs.existsSync(this.userTemplatesDir)) {
        const files = await fs.promises.readdir(this.userTemplatesDir);
        for (const file of files) {
          if (file.endsWith('.label')) {
            const filePath = path.join(this.userTemplatesDir, file);
            const readRes = await readDocumentFile(filePath);
            if (readRes.success && readRes.document) {
              const baseName = path.basename(file, '.label');
              userSummaries.push({
                id: `user-${baseName}`,
                name: readRes.document.meta.title || baseName,
                category: 'custom',
                description: `Custom user template saved as ${file}`,
                isBuiltIn: false,
                dimensions: {
                  width: readRes.document.dimensions.width,
                  height: readRes.document.dimensions.height,
                  unit: readRes.document.dimensions.unit,
                },
              });
            }
          }
        }
      }
    } catch {
      // Non-fatal if user directory can't be read
    }

    return {
      builtIn: builtInSummaries,
      user: userSummaries,
    };
  }

  /**
   * Retrieves full LabelDocument of a template by ID.
   */
  public async getTemplateDocument(
    id: string,
    isBuiltIn: boolean
  ): Promise<LabelDocument | null> {
    if (isBuiltIn) {
      const found = BUILT_IN_TEMPLATES.find((t) => t.id === id);
      return found ? found.document : null;
    }

    // User template lookup
    const rawName = id.replace(/^user-/, '');
    const candidateFile = path.join(this.userTemplatesDir, `${rawName}.label`);
    const readRes = await readDocumentFile(candidateFile);
    if (readRes.success && readRes.document) {
      return readRes.document;
    }

    return null;
  }

  /**
   * Saves a document as a user template in the app templates directory.
   */
  public async saveUserTemplate(
    templateName: string,
    document: unknown
  ): Promise<{ success: boolean; templateId?: string; errors?: string[] }> {
    const sanitized = templateName.replace(/[/\\?%*:|"<>]/g, '-').trim();
    if (!sanitized) {
      return { success: false, errors: ['Template name cannot be empty.'] };
    }

    await this.ensureDir();
    const targetPath = path.join(this.userTemplatesDir, `${sanitized}.label`);

    const saveRes = await saveDocument(targetPath, document);
    if (!saveRes.success) {
      return {
        success: false,
        errors: saveRes.errors?.map((e) => e.message),
      };
    }

    return {
      success: true,
      templateId: `user-${sanitized}`,
    };
  }
}

export const templatesService = new TemplatesService();
