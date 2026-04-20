export type JwtPayload = {
  sub: string;
  email: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
};

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
