"use client";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { BarList, ErrorBox, Skeleton, Stat } from "@/components/ui";

type D = { students: number; teachers: number; exams: number; attempts: number; average: number; pass_rate: number;
  by_subject: { subject: string; average: number }[]; by_class: { class: string; average: number }[] };
const ROLES = ["school_admin", "teacher"] as const;

export default function SchoolHome() {
  const { user } = useRequireRole([...ROLES]);
  const d = useFetch<D>(user ? "/results/school/dashboard/" : null);
  if (!user) return null;
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold">School overview</h1>
      {d.error && <ErrorBox message={d.error} onRetry={d.reload} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {d.loading ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />) : d.data && (<>
          <Stat label="Students" value={d.data.students} /><Stat label="Teachers" value={d.data.teachers} /><Stat label="Exams" value={d.data.exams} />
          <Stat label="Attempts" value={d.data.attempts} /><Stat label="Average score" value={`${d.data.average}%`} /><Stat label="Pass rate" value={`${d.data.pass_rate}%`} /></>)}
      </div>
      {d.data && <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 font-semibold">Average by subject</h2><BarList rows={d.data.by_subject.map((x) => ({ label: x.subject, value: x.average }))} /></section>
        <section className="card p-5"><h2 className="mb-3 font-semibold">Average by class</h2><BarList rows={d.data.by_class.map((x) => ({ label: x.class, value: x.average }))} /></section>
      </div>}
    </div>
  );
}
