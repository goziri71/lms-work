import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Render an email template with provided data
 * @param {string} templateName - Name of the template (without .html extension)
 * @param {Object} data - Data to replace in template
 * @returns {Promise<string>} - Rendered HTML string
 */
export async function renderTemplate(templateName, data = {}) {
  try {
    // Build path to template file
    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      "emails",
      `${templateName}.html`
    );

    // Read template file
    let template = await fs.readFile(templatePath, "utf-8");

    // Replace all placeholders {{key}} with corresponding data values
    Object.keys(data).forEach((key) => {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      template = template.replace(placeholder, data[key] || "");
    });

    return template;
  } catch (error) {
    console.error(`Error rendering template ${templateName}:`, error);
    throw new Error(`Failed to render email template: ${templateName}`);
  }
}

/**
 * Get the base email layout
 * @returns {Promise<string>} - Base layout HTML
 */
export async function getBaseLayout() {
  try {
    const layoutPath = path.join(
      __dirname,
      "..",
      "templates",
      "emails",
      "layout.html"
    );
    return await fs.readFile(layoutPath, "utf-8");
  } catch (error) {
    console.error("Error loading email layout:", error);
    throw error;
  }
}

export default renderTemplate;
