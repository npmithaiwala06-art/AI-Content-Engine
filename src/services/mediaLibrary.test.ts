import { describe,expect,it } from "vitest";
import { imagePromptForMedia } from "./mediaLibrary";
describe("media prompt workflow",()=>{it("builds a reusable prompt without an image API",()=>{const prompt=imagePromptForMedia("ABC Cafe","Weekend offer",["Instagram"],"Warm photography");expect(prompt).toContain("BRAND: ABC Cafe");expect(prompt).toContain("No platform logos");expect(prompt).toContain("without watermarks");});});
