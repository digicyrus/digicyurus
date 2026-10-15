const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 10;
const IP_LIMIT = 30;

export type LoginRateLimiter = {
  allow(email: string, ip: string): boolean;
};

export function createLoginRateLimiter(options: {
  now?: () => number;
  windowMs?: number;
  emailLimit?: number;
  ipLimit?: number;
} = {}): LoginRateLimiter {
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? WINDOW_MS;
  const emailLimit = options.emailLimit ?? EMAIL_LIMIT;
  const ipLimit = options.ipLimit ?? IP_LIMIT;
  const emails = new Map<string, number[]>();
  const ips = new Map<string, number[]>();

  function recent(stamps: number[] | undefined, time: number): number[] {
    return (stamps ?? []).filter((stamp) => time - stamp < windowMs);
  }

  return {
    allow(email, ip) {
      const time = now();
      const emailStamps = recent(emails.get(email), time);
      const ipStamps = recent(ips.get(ip), time);
      if (emailStamps.length >= emailLimit || ipStamps.length >= ipLimit) {
        emails.set(email, emailStamps);
        ips.set(ip, ipStamps);
        return false;
      }
      emailStamps.push(time);
      ipStamps.push(time);
      emails.set(email, emailStamps);
      ips.set(ip, ipStamps);
      return true;
    },
  };
}
