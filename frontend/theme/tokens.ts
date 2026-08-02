import type { TextStyle } from 'react-native';

/**
 * Escala única de espaciado de la aplicación.
 *
 * Los nombres expresan tamaño relativo para que los componentes no dependan
 * de valores arbitrarios y puedan mantener el mismo ritmo visual.
 */
export const SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Roles tipográficos base de Mayoreo.
 *
 * Cada rol reúne tamaño, interlineado y peso. Los estilos específicos de una
 * pantalla pueden sumar color o alineación, pero deben conservar esta escala.
 */
export const TYPOGRAPHY = {
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0,
  },
  metadata: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
} as const satisfies Record<'title' | 'subtitle' | 'body' | 'metadata', TextStyle>;

export type SpacingToken = keyof typeof SPACING;
export type TypographyRole = keyof typeof TYPOGRAPHY;
