import { Project } from "ts-morph";

const project = new Project({
  compilerOptions: {
    types: ["@figma/plugin-typings"],
  },
});

const sourceFile = project.createSourceFile("inspect.ts", "const api = figma;\n", {
  overwrite: true,
});

const api = sourceFile.getVariableDeclarationOrThrow("api");
const type = api.getType();

const properties = type
  .getProperties()
  .map((symbol) => symbol.getName())
  .sort((a, b) => a.localeCompare(b));

console.log(properties.join("\n"));
