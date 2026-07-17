"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiMe, User } from "@/lib/api";

export function useAuthGuard(): User | null {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    apiMe()
      .then(setUser)
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  return user;
}
