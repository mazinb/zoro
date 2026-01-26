import { readFile } from 'fs/promises';
import path from 'path';

export type EmailTemplateKey = 'welcome-reply';

const templateFileByKey: Record<EmailTemplateKey, string> = {
  'welcome-reply': 'welcome-reply.html'
};

const templateDirectory = path.join(process.cwd(), 'src', 'templates', 'email');

export async function loadEmailTemplate(key: EmailTemplateKey): Promise<string> {
  const templateFile = templateFileByKey[key];
  const templatePath = path.join(templateDirectory, templateFile);
  return readFile(templatePath, 'utf8');
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? '');
}

