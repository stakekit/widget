#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

// Function to calculate relative path from one file to another
function getRelativePath(fromFile, toPath) {
  const fromDir = path.dirname(fromFile);
  const relativePath = path.relative(fromDir, toPath);

  // Ensure the path starts with ./ or ../
  if (!relativePath.startsWith(".")) {
    return `./${relativePath}`;
  }
  return relativePath;
}

// Function to convert @sk-widget/ imports to relative imports
function convertImports(filePath, content) {
  const srcDir = path.resolve(__dirname, "src");
  const lines = content.split("\n");

  const convertedLines = lines.map((line) => {
    // Match various patterns that include @sk-widget/
    const patterns = [
      // Standard imports: import { ... } from "@sk-widget/..."
      /^(\s*import\s+.*?from\s+['"])@sk-widget\/([^'"]+)(['"].*)/,
      // Export re-exports: export { ... } from "@sk-widget/..."
      /^(\s*export\s+.*?from\s+['"])@sk-widget\/([^'"]+)(['"].*)/,
      // Dynamic imports: import("@sk-widget/...")
      /^(\s*.*?import\s*\(\s*['"])@sk-widget\/([^'"]+)(['"].*)/,
      // Comments with imports (we'll skip these for now)
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, prefix, importPath, suffix] = match;
        const targetPath = path.resolve(srcDir, importPath);
        const relativePath = getRelativePath(filePath, targetPath);

        return `${prefix}${relativePath}${suffix}`;
      }
    }

    return line;
  });

  return convertedLines.join("\n");
}

// Get all TypeScript/JavaScript files that contain @sk-widget/ imports
function getFilesToConvert() {
  try {
    const output = execSync(
      'find src tests -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | xargs grep -l "@sk-widget/" 2>/dev/null || true',
      { encoding: "utf8", cwd: __dirname }
    );

    return output.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.log(
      "No files found with @sk-widget/ imports or error occurred:",
      error.message
    );
    return [];
  }
}

// Main function
function main() {
  console.log(
    "Starting conversion of remaining @sk-widget/ imports to relative paths..."
  );

  const filesToConvert = getFilesToConvert();
  console.log(`Found ${filesToConvert.length} files to convert`);

  let convertedCount = 0;
  let errorCount = 0;

  filesToConvert.forEach((relativeFilePath) => {
    try {
      const filePath = path.resolve(__dirname, relativeFilePath);
      const content = fs.readFileSync(filePath, "utf8");

      // Check if file actually contains @sk-widget/ imports
      if (!content.includes("@sk-widget/")) {
        return;
      }

      const convertedContent = convertImports(filePath, content);

      // Only write if content changed
      if (convertedContent !== content) {
        fs.writeFileSync(filePath, convertedContent, "utf8");
        console.log("✓ Converted:", relativeFilePath);
        convertedCount++;
      }
    } catch (error) {
      console.error("✗ Error converting", relativeFilePath, ":", error.message);
      errorCount++;
    }
  });

  console.log("\nConversion complete!");
  console.log("✓ Successfully converted:", convertedCount, "files");
  if (errorCount > 0) {
    console.log("✗ Errors:", errorCount, "files");
  }
}

main();
