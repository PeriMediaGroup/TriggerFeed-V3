"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const percent = (clicks, impressions) => impressions ? `${(100 * clicks / impressions).toFixed(2)}%` : "0%";
function localDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function CampaignEditor({ campaign, creative, onClose, onSaved }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError("");
    const data = new FormData(event.currentTarget);
    const text = (key) => String(data.get(key) || "").trim();
    try {
      const { error: problem } = await createClient().rpc("save_ad_campaign", {
        p_ad: { id: campaign?.id, name: text("name"), advertiser_name: text("advertiser_name"), advertiser_type: text("advertiser_type"), status: text("status"), destination_url: text("destination_url"), starts_at: text("starts_at") ? new Date(text("starts_at")).toISOString() : null, ends_at: text("ends_at") ? new Date(text("ends_at")).toISOString() : null },
        p_creative: { id: creative?.id, headline: text("headline"), body: text("body"), image_url: text("image_url"), call_to_action: text("call_to_action"), platform: text("platform") },
        p_placement: { frequency: Number(text("frequency")), weight: Number(text("weight")), enabled: data.has("enabled") },
      });
      if (problem) throw problem;
      onSaved();
    } catch { setError("Could not save. Check HTTPS URLs, dates and required fields, then retry."); }
    finally { setSaving(false); }
  }
  return <form className="admin-ads__editor" onSubmit={save}>
    <h2>{campaign ? "Edit campaign" : "Create campaign"}</h2>
    <p>Dates use your local timezone. Changes save together.</p>
    {error ? <p role="alert">{error}</p> : null}
    <fieldset disabled={saving}><div className="admin-ads__grid">
      <label>Campaign name<input name="name" required maxLength={120} defaultValue={campaign?.name} /></label>
      <label>Advertiser<input name="advertiser_name" required maxLength={120} defaultValue={campaign?.advertiser_name || "TriggerFeed"} /></label>
      <label>Type<select name="advertiser_type" defaultValue={campaign?.advertiser_type || "house"}>{["house", "partner", "paid"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={campaign?.status || "draft"}>{["draft", "active", "paused", "ended"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label>Destination URL<input name="destination_url" type="url" required placeholder="https://" maxLength={2048} defaultValue={campaign?.destination_url} /></label>
      <label>Starts<input name="starts_at" type="datetime-local" defaultValue={localDate(campaign?.starts_at)} /></label>
      <label>Ends<input name="ends_at" type="datetime-local" defaultValue={localDate(campaign?.ends_at)} /></label>
      <label>Headline<input name="headline" required maxLength={160} defaultValue={creative?.headline} /></label>
      <label>Body<textarea name="body" maxLength={1000} defaultValue={creative?.body} /></label>
      <label>Image URL<input name="image_url" type="url" placeholder="https://" maxLength={2048} defaultValue={creative?.image_url} /></label>
      <label>Call to action<input name="call_to_action" required maxLength={60} defaultValue={creative?.call_to_action || "Learn more"} /></label>
      <label>Creative platform<select name="platform" defaultValue={creative?.platform || "all"}>{["all", "web_desktop", "web_mobile", "android"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label>Organic posts between ads<input name="frequency" type="number" min="6" max="8" required defaultValue={campaign?.feed_placement?.frequency || 7} /></label>
      <label>Rotation weight<input name="weight" type="number" min="1" max="100" required defaultValue={campaign?.feed_placement?.weight || 1} /></label>
      <label>Enable feed placement<input name="enabled" type="checkbox" defaultChecked={campaign?.feed_placement?.enabled ?? true} /></label>
    </div><div className="admin-ads__actions"><button type="submit">{saving ? "Saving..." : "Save campaign"}</button><button type="button" onClick={onClose}>Cancel</button></div></fieldset>
  </form>;
}

export default function AdminAdsPanel({ dashboard }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const summary = dashboard.summary;
  async function status(id, value) {
    setPending(true); setError("");
    try {
      const result = await createClient().rpc("set_ad_status", { p_ad_id: id, p_status: value });
      if (result.error) throw result.error;
      router.refresh();
    } catch { setError("Could not change campaign status. Please retry."); }
    finally { setPending(false); }
  }
  const metrics = [
    ["Active Campaigns", summary.active_campaigns], ["Total Impressions", summary.impressions], ["Total Clicks", summary.clicks], ["CTR", percent(summary.clicks, summary.impressions)],
    ["Desktop Impressions", summary.web_desktop], ["Mobile Web Impressions", summary.web_mobile], ["Android Impressions", summary.android],
  ];
  return <div className="admin-ads">
    <div className="admin-ads__summary">{metrics.map(([label, value]) => <article className="admin-ads__metric" key={label}>{label}<strong>{value}</strong></article>)}</div>
    <p>Lifetime totals. Impressions require viewport visibility; a delivery is not an impression.</p>
    {error ? <p role="alert">{error}</p> : null}
    <button onClick={() => setEditing({ campaign: null, creative: null })}>Create campaign</button>
    {editing ? <CampaignEditor key={`${editing.campaign?.id || "new"}:${editing.creative?.id || "new"}`} {...editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} /> : null}
    {!dashboard.campaigns.length ? <p>No campaigns yet.</p> : null}
    {dashboard.campaigns.map((campaign) => <article className="admin-ads__campaign" key={campaign.id}>
      <h2>{campaign.name}</h2><p>{campaign.advertiser_name} · {campaign.advertiser_type} · {campaign.status}</p>
      <p>Starts: {campaign.starts_at || "Any time"} | Ends: {campaign.ends_at || "No end date"}</p>
      <p>{campaign.impressions} impressions · {campaign.clicks} clicks · {percent(campaign.clicks, campaign.impressions)} CTR</p>
      <div className="admin-ads__actions">
        {campaign.creatives.map((creative) => <button key={creative.id} onClick={() => setEditing({ campaign, creative })}>Edit {creative.platform} creative</button>)}
        <button onClick={() => setEditing({ campaign, creative: null })}>Add creative</button>
        {["active", "paused", "ended"].map((value) => <button key={value} disabled={pending || campaign.status === value} onClick={() => status(campaign.id, value)}>{({ active: "Activate", paused: "Pause", ended: "End" })[value]}</button>)}
      </div>
    </article>)}
  </div>;
}
