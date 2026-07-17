"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export function useAuthGuard(): string | null {
  const router = useRouter();
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      router.push("/login");
      return;
    }
    setTokenState(stored);
  }, [router]);

  return token;
}
