/**
 * Konfiguracja Tailwinda (wcześniej inline `tailwind.config` w <head> index.html i dziekujemy.html).
 * Wersja 3.4.17 = ta sama, którą serwował cdn.tailwindcss.com, więc wygląd jest identyczny.
 * Tylko te dwie strony używają Tailwinda; quiz i polityka prywatności mają własny CSS.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./index.html', './dziekujemy.html'],
  theme: {
    extend: {
      // Kolory marki jako zmienne CSS (kanały RGB), żeby motywy kolorystyczne mogły je podmieniać.
      // Domyślne wartości (src/tailwind.css, :root) = dotychczasowe: navy #1a2744, navylt #243260,
      // navydark #111b33, gold #c9a84c, goldlt #d9bc72.
      colors: {
        navy: 'rgb(var(--c-navy) / <alpha-value>)',
        navylt: 'rgb(var(--c-navylt) / <alpha-value>)',
        navydark: 'rgb(var(--c-navydark) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        goldlt: 'rgb(var(--c-goldlt) / <alpha-value>)',
      },
      // '... Fallback' = Arial/Georgia (Roboto/Noto Serif na Androidzie) przeskalowane do metryk Inter/Playfair
      // (src/tailwind.css) - zanim czcionka się wczyta, tekst zajmuje tyle samo miejsca, więc nic nie skacze (CLS)
      fontFamily: {
        serif: ['Playfair Display', 'Playfair Fallback', 'Playfair Fallback Android', 'Georgia', 'serif'],
        sans: ['Inter', 'Inter Fallback', 'Inter Fallback Android', 'system-ui', 'sans-serif'],
      },
    },
  },
};
