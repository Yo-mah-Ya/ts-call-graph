import { EOL } from "os";

export const omitCommentsFromJson = (json: string): string => {
  if (typeof json !== "string") {
    throw new Error("json must be typeof string");
  }

  let result = "";
  for (let i = 0; i < json.length; i++) {
    if (json[i] === '"') {
      while (i < json.length) {
        result += json[i++];
        if (json[i] === '"') {
          result += json[i];
          break;
        }
      }
      continue;
    }

    if (i <= json.length - 2 && json[i] + json[i + 1] === "//") {
      i++;
      while (i < json.length && json[i] !== EOL) {
        i++;
      }
    }
    if (i <= json.length - 2 && json[i] + json[i + 1] === "/*") {
      i += 2;
      let found = false;
      while (i <= json.length - 2) {
        if (json[i] + json[i + 1] === "*/") {
          found = true;
          i += 2;
          break;
        }
        i++;
      }
      if (!found) {
        throw new Error("unclosed block comment");
      }
    }
    result += json[i];
  }
  return result;
};
