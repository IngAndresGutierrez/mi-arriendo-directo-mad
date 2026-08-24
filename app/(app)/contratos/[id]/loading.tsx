import { LoadingScreen, Skeleton } from "@/shared/ui/skeleton";

/** The process page: a heading, the terms of the application, and seven stages. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el proceso…">
      <div className="mx-auto w-full max-w-3xl">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-9 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />

        <Skeleton className="mt-6 h-44 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-11 w-64 rounded-xl" />

        <div className="mt-8 space-y-3">
          {/* Cinco de las siete: las que caben antes del pliegue, que es lo que se ve. */}
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </LoadingScreen>
  );
}
