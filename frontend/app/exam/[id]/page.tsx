"use client";
import { useParams } from "next/navigation";
import ExamRunner from "@/components/ExamRunner";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";

const ROLES = ["public_user"] as const;
export default function PublicExam() {
  const { id } = useParams<{ id: string }>();
  const { user } = useRequireRole([...ROLES]);
  return user ? <ExamRunner mode="public" id={id} /> : <Spinner />;
}
