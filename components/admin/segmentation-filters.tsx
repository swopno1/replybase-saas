"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

export type SegmentationFilters = {
  planName?: string;
  channelType?: "telegram" | "facebook" | "web";
  cohortWeekStart?: string;
};

type Props = {
  plans: Array<{ name: string; displayName: string; price: number }>;
  channelTypes: ("telegram" | "facebook" | "web")[];
  cohorts: Array<{ weekStart: string; label: string; tenantCount: number }>;
  filters: SegmentationFilters;
  onFilterChange: (filters: SegmentationFilters) => void;
};

function formatChannelTypeLabel(type: "telegram" | "facebook" | "web") {
  if (type === "telegram") {
    return "Telegram";
  }

  if (type === "web") {
    return "Webchat";
  }

  return "Legacy Messenger";
}

export function SegmentationFilters({
  plans,
  channelTypes,
  cohorts,
  filters,
  onFilterChange,
}: Props) {
  const handlePlanChange = (value: string) => {
    onFilterChange({
      ...filters,
      planName: value || undefined,
    });
  };

  const handleChannelChange = (value: string) => {
    onFilterChange({
      ...filters,
      channelType: (value as "telegram" | "facebook" | "web") || undefined,
    });
  };

  const handleCohortChange = (value: string) => {
    onFilterChange({
      ...filters,
      cohortWeekStart: value || undefined,
    });
  };

  const hasActiveFilters =
    filters.planName || filters.channelType || filters.cohortWeekStart;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Segmentation Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Plan Filter */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Plan Tier
              </label>
              <Select
                value={filters.planName || "all"}
                onValueChange={handlePlanChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.name} value={plan.name}>
                      {plan.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel Filter */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Channel Type
              </label>
              <Select
                value={filters.channelType || "all"}
                onValueChange={handleChannelChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {channelTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatChannelTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cohort Filter */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Signup Cohort
              </label>
              <Select
                value={filters.cohortWeekStart || "all"}
                onValueChange={handleCohortChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.weekStart} value={cohort.weekStart}>
                      {cohort.label} ({cohort.tenantCount} users)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between rounded-md bg-blue-50 p-3 text-sm">
              <p className="text-blue-700">
                Showing{" "}
                {
                  [
                    filters.planName,
                    filters.channelType,
                    filters.cohortWeekStart,
                  ].filter(Boolean).length
                }{" "}
                active filter(s)
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFilterChange({})}
                className="h-auto p-0 text-blue-600 hover:text-blue-800"
              >
                <X className="mr-1 h-4 w-4" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
