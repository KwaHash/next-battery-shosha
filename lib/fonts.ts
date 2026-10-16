import { Noto_Sans_JP, Noto_Sans } from 'next/font/google'

export const notoSansJP = Noto_Sans_JP({
  weight: ['100', '300', '400', '500', '700', '900'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  // Make it possible to distribute it using CSS variables as well.
  // Because the inheritance of className does not reach components that have their own font-family outside the body, like toasts.
  variable: '--font-noto-sans-jp',
})

export const notoSans = Noto_Sans({
  weight: ['100', '300', '400', '500', '700', '900'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
})