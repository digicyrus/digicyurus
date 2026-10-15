import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
    plugins: [
        tanstackStart(),
        react(),
        tailwindcss(),
    ],

    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});