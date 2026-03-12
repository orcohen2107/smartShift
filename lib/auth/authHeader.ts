export function getAccessTokenFromRequest(req: Request) {
  const header: string | null =
    req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;

  const [scheme, token]: string[] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token.trim();
}
