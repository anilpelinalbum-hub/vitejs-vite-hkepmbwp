export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial"],
      },
      colors: {
        blush: "#FDECF2",
        blushDark: "#F8DDE8",
        roseBtn: "#EC7193",
        roseBtnHover: "#D95F82",
      },
      boxShadow: {
        card: "0 10px 30px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};