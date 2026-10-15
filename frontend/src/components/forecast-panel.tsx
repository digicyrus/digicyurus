import { useEffect, useState, type FormEvent } from "react";

import { Panel } from "@/components/page-kit";
import { useResolvedLabels } from "@/components/relation-picker";
import { FormAlert, Notice, TextField } from "@/components/sales-form";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDay } from "@/lib/crm";
import { inr } from "@/lib/mock-data";
import { canBrowseEmployees, linkedLabel, lookupEmployeeName } from "@/lib/relations";
import {
    canUpdateOpportunity,
    canViewForecast,
    currentMonthRange,
    forecastRange,
    forecastWeightCopy,
    OPEN_STAGES,
    probabilityBody,
    sales,
    showWeightedAmount,
    type Forecast,
    type OpenStage,
} from "@/lib/sales";

const blankWeights = (): Record<OpenStage, string> => ({
    Qualification: "",
    Discovery: "",
    Proposal: "",
    Negotiation: "",
});

export function ForecastPanel() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewForecast(permissions);
    const canConfigure = canUpdateOpportunity(permissions);
    const initial = currentMonthRange();
    const [from, setFrom] = useState(initial.from);
    const [to, setTo] = useState(initial.to);
    const [forecast, setForecast] = useState<Forecast | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [rangeFields, setRangeFields] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [weights, setWeights] = useState<Record<OpenStage, string>>(blankWeights);
    const [weightFields, setWeightFields] = useState<Record<string, string>>({});
    const [weightMessage, setWeightMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [revision, setRevision] = useState(0);
    const ownerLabels = useResolvedLabels(forecast?.byOwner.map((owner) => owner.ownerEmployeeId) ?? [], canBrowseEmployees(permissions), lookupEmployeeName);

    useEffect(() => {
        if (!canView) {
            setLoading(false);
            return;
        }
        const range = forecastRange(from, to);
        if (!range.ok) {
            setForecast(null);
            setLoading(false);
            setRangeFields(range.fields);
            setMessage(range.fields.to ?? range.fields.from ?? range.message);
            return;
        }
        setRangeFields({});
        let active = true;
        setLoading(true);
        void sales.forecast.get(range.body).then((result) => {
            if (!active) return;
            setForecast(result);
            setMessage(null);
            const next = blankWeights();
            for (const stage of result.byStage) {
                if (stage.probability !== null && (OPEN_STAGES as readonly string[]).includes(stage.stage)) {
                    next[stage.stage as OpenStage] = String(stage.probability);
                }
            }
            setWeights(next);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setForecast(null);
            setMessage(failure.message);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [canView, from, to, revision, auth.refresh]);

    async function saveWeights(event: FormEvent) {
        event.preventDefault();
        const checked = probabilityBody(weights);
        if (!checked.ok) {
            setWeightFields(checked.fields);
            setWeightMessage(checked.message);
            return;
        }
        setSaving(true);
        setWeightMessage(null);
        try {
            await sales.forecast.saveProbabilities(checked.body);
            setWeightFields({});
            setRevision((current) => current + 1);
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setWeightFields(failure.fields);
            setWeightMessage(failure.message);
        } finally {
            setSaving(false);
        }
    }

    if (!canView) {
        return <Panel title="Forecast"><p role="alert" className="text-sm text-destructive">You do not have access to this.</p></Panel>;
    }

    return (
        <div className="space-y-4">
            <Notice>Pipeline value is the open-deal total. Weighted forecast appears only where a stage probability is saved. Won and lost totals are closed opportunity values for the selected dates, not invoice revenue.</Notice>
            <div className="flex flex-wrap gap-3">
                <TextField label="From" type="date" value={from} error={rangeFields.from} onChange={setFrom} />
                <TextField label="To" type="date" value={to} error={rangeFields.to} onChange={setTo} />
            </div>
            <FormAlert message={message} />
            {loading ? <p className="text-sm text-muted-foreground">Loading forecast…</p> : null}
            {forecast ? (
                <>
                    <p className="text-sm">{forecastWeightCopy(forecast.weighting)}</p>
                    {forecast.weighting !== "complete" ? <p className="text-sm text-muted-foreground">Unweighted pipeline value: {inr(forecast.unweightedPipelineValue)}</p> : null}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Metric label="Open pipeline" value={`${forecast.pipelineCount} · ${inr(forecast.pipelineValue)}`} />
                        <Metric label="Expected to close in period" value={`${forecast.periodPipelineCount} · ${inr(forecast.periodPipelineValue)}`} />
                        <Metric label="Weighted forecast" value={showWeightedAmount(forecast.weighting, forecast.weightedForecast) ? inr(forecast.weightedForecast) : "Not configured"} />
                        <Metric label="Weighted forecast in period" value={showWeightedAmount(forecast.weighting, forecast.periodWeightedForecast) ? inr(forecast.periodWeightedForecast) : "Not configured"} />
                        <Metric label="Won in period" value={`${forecast.closedDeals.wonCount} · ${inr(forecast.closedDeals.wonValue)}`} />
                        <Metric label="Lost in period" value={`${forecast.closedDeals.lostCount} · ${inr(forecast.closedDeals.lostValue)}`} />
                    </div>
                    <Panel title="By stage" description={`${formatDay(forecast.period.from)} – ${formatDay(forecast.period.to)}`}>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Stage</TableHead>
                                        <TableHead>Count</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Probability</TableHead>
                                        <TableHead>Weighted</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {forecast.byStage.map((stage) => (
                                        <TableRow key={stage.stage}>
                                            <TableCell>{stage.stage}</TableCell>
                                            <TableCell>{stage.count}</TableCell>
                                            <TableCell className="font-mono text-xs">{inr(stage.value)}</TableCell>
                                            <TableCell>{stage.probability === null ? "Not configured" : `${stage.probability}%`}</TableCell>
                                            <TableCell className="font-mono text-xs">{stage.weightedForecast === null ? "Not configured" : inr(stage.weightedForecast)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Panel>
                    <Panel title="By owner" description={canBrowseEmployees(permissions) ? "Open pipeline by assigned employee" : "Owner names need employee access"}>
                        {forecast.byOwner.length === 0 ? <p className="text-sm text-muted-foreground">No open opportunities.</p> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Owner</TableHead>
                                            <TableHead>Count</TableHead>
                                            <TableHead>Pipeline value</TableHead>
                                            <TableHead>Weighted</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {forecast.byOwner.map((owner) => (
                                            <TableRow key={owner.ownerEmployeeId ?? "unassigned"}>
                                                <TableCell>{linkedLabel(owner.ownerEmployeeId, ownerLabels, "Unassigned", "Owner name unavailable")}</TableCell>
                                                <TableCell>{owner.count}</TableCell>
                                                <TableCell className="font-mono text-xs">{inr(owner.pipelineValue)}</TableCell>
                                                <TableCell className="font-mono text-xs">{owner.weightedForecast === null ? "Not configured" : inr(owner.weightedForecast)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </Panel>
                    <Panel title="By expected closing month">
                        {forecast.byExpectedCloseMonth.length === 0 ? <p className="text-sm text-muted-foreground">No open opportunities with an expected closing date.</p> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Month</TableHead>
                                            <TableHead>Count</TableHead>
                                            <TableHead>Pipeline value</TableHead>
                                            <TableHead>Weighted</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {forecast.byExpectedCloseMonth.map((month) => (
                                            <TableRow key={month.month}>
                                                <TableCell>{month.month}</TableCell>
                                                <TableCell>{month.count}</TableCell>
                                                <TableCell className="font-mono text-xs">{inr(month.pipelineValue)}</TableCell>
                                                <TableCell className="font-mono text-xs">{month.weightedForecast === null ? "Not configured" : inr(month.weightedForecast)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </Panel>
                    <Panel title="Stage probabilities" description="Blank stages stay unconfigured. Saving every stage blank removes the weights. A saved 0% is a real probability, not a missing one.">
                        {canConfigure ? (
                            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void saveWeights(event)}>
                                <FormAlert message={weightMessage} />
                                {OPEN_STAGES.map((stage) => (
                                    <TextField key={stage} label={`${stage} %`} value={weights[stage]} error={weightFields[stage]} onChange={(value) => setWeights((current) => ({ ...current, [stage]: value }))} />
                                ))}
                                <div className="sm:col-span-2">
                                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save probabilities"}</Button>
                                </div>
                            </form>
                        ) : <Notice>You can view the forecast. Saving stage probabilities needs pipeline update access.</Notice>}
                    </Panel>
                </>
            ) : null}
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <Panel title={label}>
            <p className="font-mono text-sm">{value}</p>
        </Panel>
    );
}
