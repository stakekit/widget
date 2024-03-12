import https from "https";
import { readFile, writeFile } from "fs/promises";
import fs from "fs";
import prettier from "prettier";

async function content(path) {
  return await readFile(path, "utf8");
}

async function downloadFile(url, targetFile) {
  return await new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const code = response.statusCode ?? 0;

        if (code >= 400) {
          return reject(new Error(response.statusMessage));
        }

        // handle redirects
        if (code > 300 && code < 400 && !!response.headers.location) {
          return resolve(downloadFile(response.headers.location, targetFile));
        }

        // save the file to disk
        const fileWriter = fs.createWriteStream(targetFile).on("finish", () => {
          resolve(null);
        });

        response.pipe(fileWriter);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

function createErrorString(errorObj) {
  let errorsArray =
    "// Generated by get-errors.js script.\n// Do not edit manually.\n\n";
  errorsArray += "export const errorsSet = new Set([\n";

  Object.keys(errorObj).forEach(function (key) {
    errorsArray += `\t"${key}",\n`;
  });

  errorsArray += "]);\n";
  return errorsArray;
}

function createErrorStringUnion(errorObj) {
  let errorsArray = "\n\n";
  errorsArray += "export type ErrorsSet =\n";

  Object.keys(errorObj).forEach(function (key) {
    errorsArray += `\t| "${key}"\n`;
  });

  errorsArray += ";\n";
  return errorsArray;
}

async function writeStringToFile(str, path) {
  return writeFile(path, str, "utf8");
}

const errorsURL = "https://i18n.stakek.it/locales/en/errors.json";
const targetFile = "./src/translation/English/errors.json";
const targetTsFile = "./src/utils/errors.ts";

await downloadFile(errorsURL, targetFile);
const errors = await content(targetFile);

const errorsJSON = JSON.parse(errors);
const str = createErrorString(errorsJSON);
const typeString = createErrorStringUnion(errorsJSON);
await writeStringToFile(str + typeString, targetTsFile);

await prettier.resolveConfig(".prettierrc").then((config) =>
  Promise.all(
    [targetFile, targetTsFile].map((file) =>
      fs.promises
        .readFile(file, { encoding: "utf-8" })
        .then((code) => prettier.format(code, { ...config, filepath: file }))
        .then((formatted) => fs.promises.writeFile(file, formatted))
    )
  )
);