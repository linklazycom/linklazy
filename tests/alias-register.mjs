// Lets the plain Node test runner resolve the project's "@/..." imports.
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
