import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { worklogMockService } from "@/features/worklogs/mockService";
import type {
  PaymentConfirmation,
  TimeEntry,
  WorklogWithFreelancer,
} from "@/features/worklogs/types";
import useCustomToast from "@/hooks/useCustomToast";

export const Route = createFileRoute("/_layout/worklogs")({
  component: WorklogsPage,
  head: () => ({
    meta: [
      {
        title: "Worklogs - FastAPI Cloud",
      },
    ],
  }),
});

type WorklogWithComputed = WorklogWithFreelancer & {
  totalHours: number;
  totalAmountUsd: number;
  latestEntryDateUtc: string;
  eligibleEntries: TimeEntry[];
  eligibleAmountUsd: number;
};

const getEntryAmount = (entry: TimeEntry) => entry.hours * entry.hourlyRateUsd;

const isEntryInRange = (entry: TimeEntry, from: string, to: string) => {
  const entryDate = new Date(entry.date);
  const dateFrom = new Date(`${from}T00:00:00.000Z`);
  const dateTo = new Date(`${to}T23:59:59.999Z`);
  return entryDate >= dateFrom && entryDate <= dateTo;
};

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatUtcTimestamp = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");

  const hours24 = parsed.getUTCHours();
  const minutes = String(parsed.getUTCMinutes()).padStart(2, "0");
  const meridiem = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${year}-${month}-${day}, ${hours12}:${minutes}${meridiem}`;
};

function WorklogsPage() {
  const { showErrorToast, showSuccessToast } = useCustomToast();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedWorklogIds, setSelectedWorklogIds] = useState<string[]>([]);
  const [excludedWorklogIds, setExcludedWorklogIds] = useState<string[]>([]);
  const [excludedFreelancerIds, setExcludedFreelancerIds] = useState<string[]>(
    [],
  );
  const [detailsWorklogId, setDetailsWorklogId] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<PaymentConfirmation | null>(
    null,
  );

  const worklogsQuery = useQuery({
    queryFn: () => worklogMockService.listWorklogsWithDetails(),
    queryKey: ["worklogs-dashboard"],
  });

  const allWorklogs = useMemo<WorklogWithComputed[]>(() => {
    const items = worklogsQuery.data ?? [];

    return items.map((worklog) => {
      const totalHours = worklog.entries.reduce(
        (total, entry) => total + entry.hours,
        0,
      );
      const totalAmountUsd = worklog.entries.reduce(
        (total, entry) => total + getEntryAmount(entry),
        0,
      );

      const latestEntryDateUtc = worklog.entries.reduce<string>(
        (latest, entry) => {
          if (!latest) {
            return entry.date;
          }

          return new Date(entry.date) > new Date(latest) ? entry.date : latest;
        },
        "",
      );

      const eligibleEntries =
        dateFrom && dateTo
          ? worklog.entries.filter((entry) =>
              isEntryInRange(entry, dateFrom, dateTo),
            )
          : worklog.entries;

      const eligibleAmountUsd = eligibleEntries.reduce(
        (total, entry) => total + getEntryAmount(entry),
        0,
      );

      return {
        ...worklog,
        totalHours,
        totalAmountUsd,
        latestEntryDateUtc,
        eligibleEntries,
        eligibleAmountUsd,
      };
    });
  }, [dateFrom, dateTo, worklogsQuery.data]);

  const eligibleWorklogs = useMemo(() => {
    if (!dateFrom || !dateTo) {
      return allWorklogs;
    }

    return allWorklogs.filter((worklog) => worklog.eligibleEntries.length > 0);
  }, [allWorklogs, dateFrom, dateTo]);

  useEffect(() => {
    setSelectedWorklogIds((previous) => {
      const eligibleIds = new Set(
        eligibleWorklogs.map((worklog) => worklog.id),
      );
      return previous.filter((id) => eligibleIds.has(id));
    });
  }, [eligibleWorklogs]);

  const selectedWorklogSet = useMemo(
    () => new Set(selectedWorklogIds),
    [selectedWorklogIds],
  );

  const isDateRangeActive = Boolean(dateFrom && dateTo);
  const canReview = selectedWorklogIds.length > 0;
  const allEligibleSelected =
    eligibleWorklogs.length > 0 &&
    selectedWorklogIds.length === eligibleWorklogs.length;

  const selectedWorklogs = useMemo(
    () =>
      eligibleWorklogs.filter((worklog) => selectedWorklogSet.has(worklog.id)),
    [eligibleWorklogs, selectedWorklogSet],
  );

  const selectedFreelancers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();

    for (const worklog of selectedWorklogs) {
      if (!map.has(worklog.freelancer.id)) {
        map.set(worklog.freelancer.id, {
          id: worklog.freelancer.id,
          name: worklog.freelancer.name,
          email: worklog.freelancer.email,
        });
      }
    }

    return Array.from(map.values());
  }, [selectedWorklogs]);

  const detailsWorklog = useMemo(() => {
    if (!detailsWorklogId) {
      return null;
    }

    return (
      allWorklogs.find((worklog) => worklog.id === detailsWorklogId) ?? null
    );
  }, [allWorklogs, detailsWorklogId]);

  const reviewQuery = useQuery({
    enabled: isReviewOpen && canReview,
    queryFn: () =>
      worklogMockService.getPaymentReview({
        dateFrom,
        dateTo,
        selectedWorklogIds,
        excludedFreelancerIds,
        excludedWorklogIds,
      }),
    queryKey: [
      "worklog-payment-review",
      dateFrom,
      dateTo,
      selectedWorklogIds.join(","),
      excludedWorklogIds.join(","),
      excludedFreelancerIds.join(","),
    ],
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      worklogMockService.confirmPaymentBatch({
        dateFrom,
        dateTo,
        selectedWorklogIds,
        excludedFreelancerIds,
        excludedWorklogIds,
      }),
    onError: () => {
      showErrorToast("Failed to confirm payment batch.");
    },
    onSuccess: (result) => {
      setConfirmation(result);
      setIsReviewOpen(false);
      setSelectedWorklogIds([]);
      setExcludedFreelancerIds([]);
      setExcludedWorklogIds([]);
      showSuccessToast("Payment batch confirmed successfully.");
    },
  });

  if (worklogsQuery.isLoading) {
    return <div className="text-muted-foreground">Loading worklogs...</div>;
  }

  if (worklogsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to load worklogs</AlertTitle>
        <AlertDescription>
          Please refresh this page and try again.
        </AlertDescription>
      </Alert>
    );
  }

  const toggleWorklogSelection = (worklogId: string, checked: boolean) => {
    setSelectedWorklogIds((previous) => {
      if (checked) {
        return [...new Set([...previous, worklogId])];
      }

      return previous.filter((id) => id !== worklogId);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWorklogIds(eligibleWorklogs.map((worklog) => worklog.id));
      return;
    }

    setSelectedWorklogIds([]);
  };

  const openReview = () => {
    setExcludedFreelancerIds([]);
    setExcludedWorklogIds([]);
    setIsReviewOpen(true);
  };

  const toggleExcludedWorklog = (worklogId: string, checked: boolean) => {
    setExcludedWorklogIds((previous) => {
      if (checked) {
        return [...new Set([...previous, worklogId])];
      }

      return previous.filter((id) => id !== worklogId);
    });
  };

  const toggleExcludedFreelancer = (freelancerId: string, checked: boolean) => {
    setExcludedFreelancerIds((previous) => {
      if (checked) {
        return [...new Set([...previous, freelancerId])];
      }

      return previous.filter((id) => id !== freelancerId);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Worklogs</h1>
        <p className="text-muted-foreground">
          Review freelancer worklogs, filter payment-eligible entries, and build
          payment batches.
        </p>
      </div>

      {confirmation && (
        <Alert>
          <AlertTitle>Payment batch confirmed</AlertTitle>
          <AlertDescription>
            Batch {confirmation.batchId} paid {confirmation.paidEntries} entries
            across {confirmation.paidWorklogs} worklogs (
            {formatUsd(confirmation.totalAmountUsd)}) at{" "}
            {formatUtcTimestamp(confirmation.paidAt)}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment cycle filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label htmlFor="date-from" className="text-sm font-medium">
                Date from
              </label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="date-to" className="text-sm font-medium">
                Date to
              </label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSelectedWorklogIds([]);
                }}
              >
                Clear filter
              </Button>
            </div>

            <div className="flex items-end">
              <Badge variant={isDateRangeActive ? "default" : "secondary"}>
                {isDateRangeActive
                  ? `${eligibleWorklogs.length} eligible worklogs`
                  : "Select a date range"}
              </Badge>
            </div>
          </div>

          {!isDateRangeActive && (
            <p className="text-sm text-muted-foreground">
              Set both dates to determine payment eligibility for time entries.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>All worklogs</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={openReview}
                disabled={!canReview}
                aria-label="Review selected worklogs before confirming payment"
              >
                Review Payment Batch
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 min-w-0">
          <div className="min-w-0">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all eligible worklogs"
                      checked={allEligibleSelected}
                      onCheckedChange={(value) =>
                        toggleSelectAll(Boolean(value))
                      }
                    />
                  </TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Freelancer</TableHead>
                  <TableHead>Total Earnings</TableHead>
                  <TableHead>Eligible Earnings</TableHead>
                  <TableHead>Latest Entry UTC</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleWorklogs.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      className="h-20 text-center text-muted-foreground"
                      colSpan={8}
                    >
                      No worklogs match the current date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleWorklogs.map((worklog) => {
                    const selected = selectedWorklogSet.has(worklog.id);

                    return (
                      <TableRow key={worklog.id}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Select worklog ${worklog.id}`}
                            checked={selected}
                            disabled={worklog.eligibleEntries.length === 0}
                            onCheckedChange={(value) =>
                              toggleWorklogSelection(worklog.id, Boolean(value))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{worklog.taskName}</div>
                          <div className="text-xs text-muted-foreground">
                            {worklog.id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {worklog.freelancer.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {worklog.freelancer.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatUsd(worklog.totalAmountUsd)}
                        </TableCell>
                        <TableCell>
                          {formatUsd(worklog.eligibleAmountUsd)}
                        </TableCell>
                        <TableCell>
                          {formatUtcTimestamp(worklog.latestEntryDateUtc)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              worklog.status === "paid"
                                ? "secondary"
                                : "default"
                            }
                          >
                            {worklog.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailsWorklogId(worklog.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Selected worklogs: {selectedWorklogIds.length}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(detailsWorklog)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsWorklogId(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto min-w-0">
          <DialogHeader>
            <DialogTitle>Worklog details</DialogTitle>
            <DialogDescription>
              Review each time entry before including this worklog in a payment
              batch.
            </DialogDescription>
          </DialogHeader>

          {detailsWorklog && (
            <div className="space-y-4 min-w-0">
              <div className="rounded-lg border p-4 text-sm">
                <div className="font-medium">{detailsWorklog.taskName}</div>
                <div className="text-muted-foreground">{detailsWorklog.id}</div>
                <div className="mt-2 text-muted-foreground">
                  {detailsWorklog.freelancer.name} (
                  {detailsWorklog.freelancer.email})
                </div>
              </div>

              <div className="min-w-0">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Entry</TableHead>
                      <TableHead>Date UTC</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="w-24">Eligible</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailsWorklog.entries.map((entry) => {
                      const eligible =
                        !dateFrom ||
                        !dateTo ||
                        isEntryInRange(entry, dateFrom, dateTo);

                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.id}</TableCell>
                          <TableCell>
                            {formatUtcTimestamp(entry.date)}
                          </TableCell>
                          <TableCell>{entry.hours.toFixed(2)}</TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell>
                            {formatUsd(getEntryAmount(entry))}
                          </TableCell>
                          <TableCell>
                            <Badge variant={eligible ? "default" : "secondary"}>
                              {eligible ? "yes" : "no"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="text-sm text-muted-foreground">
                Total: {detailsWorklog.totalHours.toFixed(2)}h /{" "}
                {formatUsd(detailsWorklog.totalAmountUsd)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto min-w-0 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Payment review</DialogTitle>
            <DialogDescription>
              Validate selected worklogs and included time entries before
              confirming payment.
            </DialogDescription>
          </DialogHeader>

          {!canReview && (
            <Alert variant="destructive">
              <AlertTitle>Review not available</AlertTitle>
              <AlertDescription>
                Select at least one worklog to review payment.
              </AlertDescription>
            </Alert>
          )}

          {canReview && reviewQuery.isLoading && (
            <div className="text-muted-foreground">
              Loading payment review...
            </div>
          )}

          {canReview && reviewQuery.isError && (
            <Alert variant="destructive">
              <AlertTitle>Failed to build payment review</AlertTitle>
              <AlertDescription>Please try again in a moment.</AlertDescription>
            </Alert>
          )}

          {canReview && reviewQuery.data && (
            <div className="space-y-6 min-w-0">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Included worklogs</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold sm:text-2xl">
                    {reviewQuery.data.includedWorklogs.length}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Included entries</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold sm:text-2xl">
                    {reviewQuery.data.includedEntries.length}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total hours</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold sm:text-2xl">
                    {reviewQuery.data.totalHours.toFixed(2)}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total payout</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold sm:text-2xl">
                    {formatUsd(reviewQuery.data.totalAmountUsd)}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Exclude freelancers from this batch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFreelancers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No freelancers selected.
                    </p>
                  ) : (
                    selectedFreelancers.map((freelancer) => {
                      const excluded = excludedFreelancerIds.includes(
                        freelancer.id,
                      );

                      return (
                        <label
                          key={freelancer.id}
                          className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="font-medium">{freelancer.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {freelancer.email}
                            </div>
                          </div>
                          <Checkbox
                            aria-label={`Exclude freelancer ${freelancer.name}`}
                            checked={excluded}
                            onCheckedChange={(value) =>
                              toggleExcludedFreelancer(
                                freelancer.id,
                                Boolean(value),
                              )
                            }
                          />
                        </label>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Selected worklogs and included entries</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                  <div className="min-w-0">
                    <Table className="min-w-[820px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10">Exclude</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Freelancer</TableHead>
                          <TableHead>Included Entries</TableHead>
                          <TableHead>Included Amount</TableHead>
                          <TableHead className="w-28">State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedWorklogs.map((worklog) => {
                          const excluded =
                            excludedWorklogIds.includes(worklog.id) ||
                            excludedFreelancerIds.includes(
                              worklog.freelancerId,
                            );

                          const includedEntries = worklog.eligibleEntries;
                          const includedAmount = includedEntries.reduce(
                            (total, entry) => total + getEntryAmount(entry),
                            0,
                          );

                          return (
                            <TableRow key={worklog.id}>
                              <TableCell>
                                <Checkbox
                                  aria-label={`Exclude worklog ${worklog.id}`}
                                  checked={excludedWorklogIds.includes(
                                    worklog.id,
                                  )}
                                  onCheckedChange={(value) =>
                                    toggleExcludedWorklog(
                                      worklog.id,
                                      Boolean(value),
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  {worklog.taskName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {worklog.id}
                                </div>
                              </TableCell>
                              <TableCell>{worklog.freelancer.name}</TableCell>
                              <TableCell>{includedEntries.length}</TableCell>
                              <TableCell>{formatUsd(includedAmount)}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={excluded ? "secondary" : "default"}
                                >
                                  {excluded ? "excluded" : "included"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReviewOpen(false)}
              disabled={confirmMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={
                !canReview || confirmMutation.isPending || !reviewQuery.data
              }
              aria-label="Confirm payment batch"
            >
              {confirmMutation.isPending ? "Confirming..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
