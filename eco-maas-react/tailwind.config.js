/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- 這行最重要！它告訴 Tailwind 去 src 資料夾底下找所有的 jsx 檔案
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}