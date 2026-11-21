import { View, div } from "gpui-kit";
import { Checkbox, h_flex, v_flex, Textarea, TextareaState } from "gpui-base";
import { closeOverlay, hc, props, theme } from "herdr";
import { model, send } from "./attn.js";
import { groupPrompts, inspectPrompt } from "./group.js";

const QUICK = ["Yes, go ahead.", "No, don't do that.", "Continue."];
const name = (a) => a.name || a.title;
const label = (a) => `${name(a)} · ${a.spaceName || "No space"}`;

async function readPrompt(agent) {
  const result = await hc(["read", agent.address, "--lines", "30"]);
  return result.code === 0 ? inspectPrompt(agent, result.stdout) : null;
}

function button(t, id, label, action, active = false) {
  return h_flex().id(id).min_h(26).px(9).items_center().rounded(6).border_1()
    .border_color(active ? t.accent : t.border).bg(t.raised).cursor_pointer()
    .hover((el) => el.bg(t.hover)).on_click(action).child(label);
}

export default class ConductBatch extends View {
  init(_p, cx) {
    this.cx = cx;
    this.groups = [];
    this.forms = [];
    this.unavailable = [];
    this.loading = true;
    this.sending = false;
    cx.spawn(() => this.load());
  }

  async load() {
    const entries = [];
    this.prompts = new Map();
    for (const agent of model().list.filter((a) => a.status === "blocked")) {
      const prompt = await readPrompt(agent).catch(() => null);
      if (prompt?.form) this.forms.push(agent);
      else if (prompt?.key) {
        entries.push({ agent, prompt });
        this.prompts.set(agent.address, prompt);
      } else this.unavailable.push(agent);
    }
    this.groups = groupPrompts(entries).map((group, index) => {
      const input = TextareaState.new({ value: "", rows: 3, placeholder: "Write a reply…" });
      const card = {
        ...group, index, input, selected: new Set(group.agents.map((a) => a.address)),
        results: new Map(), confirmation: null,
      };
      input.on("change", (_e, cx) => { card.confirmation = null; cx.notify(); });
      return card;
    });
    this.loading = false;
    this.cx.notify();
  }

  async submit(card) {
    const targets = card.agents.filter((a) => card.selected.has(a.address));
    const text = card.input.value();
    if (this.sending || !targets.length || !text.trim()) return;
    const confirmation = JSON.stringify([targets.map((a) => a.address), text]);
    if (card.confirmation !== confirmation) {
      for (const group of this.groups) group.confirmation = null;
      card.confirmation = confirmation;
      this.cx.notify();
      return;
    }

    card.confirmation = null;
    this.sending = true;
    this.cx.notify();
    try {
      for (const target of targets) {
        let status = "Failed";
        try {
          const agent = model().nodes.get(target.address);
          const prompt = agent?.status === "blocked" && agent.since === target.since
            ? await readPrompt(agent) : null;
          if (prompt?.message !== this.prompts.get(target.address).message ||
              (prompt?.permission && !card.permission)) status = "Failed · prompt changed";
          // send() records noteAnswered() after a successful delivery.
          else if (await send(target.address, text)) status = "Sent";
        } catch {
          status = "Failed";
        }
        card.results.set(target.address, status);
        if (status === "Sent") card.selected.delete(target.address);
        this.cx.notify();
      }
    } finally {
      this.sending = false;
      this.cx.notify();
    }
  }

  card(t, card) {
    const { index, input, agents, selected, results } = card;
    const targets = agents.filter((a) => selected.has(a.address));
    const text = input.value();
    const sendLabel = `Send to ${targets.length} agents`;
    return v_flex().flex_none().p(12).gap(8).rounded(8).bg(t.surface).border_1().border_color(t.border)
      .child(div().font_semibold().child(card.message))
      .children(agents.map((a) => {
        const sent = results.get(a.address) === "Sent";
        const checked = sent || selected.has(a.address);
        return Checkbox.new().id(`batch-agent-${a.address}`).w_full()
          .checked(checked).disabled(sent || this.sending)
          .when(!sent && !this.sending, (el) => el.cursor_pointer())
          .on_change((on, cx) => {
            if (this.sending || results.get(a.address) === "Sent") return;
            if (on) selected.add(a.address);
            else selected.delete(a.address);
            card.confirmation = null;
            cx.notify();
          })
          .child(h_flex().w_full().gap(8).items_center()
            .child(div().flex_none().text_color(t.accent).child(checked ? "☑" : "☐"))
            .child(div().flex_1().min_w(0).child(label(a)))
            .child(div().text_color(sent ? t.done : t.blocked).child(results.get(a.address) ?? "")));
      }))
      .child(h_flex().gap(6).flex_wrap().children(QUICK.map((reply, i) =>
        button(t, `batch-quick-${index}-${i}`, reply, () => {
          if (this.sending) return;
          card.confirmation = null;
          input.set_value(reply);
          this.cx.notify();
        }, text === reply),
      )))
      .child(Textarea.new(input).px(9).py(6).rounded(6).border_1().border_color(t.input).bg(t.background))
      .child(div().text_color(t.muted).child(`Will send to ${targets.length} agents: ${targets.map(name).join(", ") || "none"}`))
      .when(card.permission, (el) => el.child(div().text_color(t.blocked).child("This answers permission prompts on your behalf.")))
      .when(Boolean(card.confirmation), (el) => el.child(div().text_color(t.accent).child(`Click “${sendLabel}” again to confirm.`)))
      .child(h_flex().children(this.sending || !targets.length || !text.trim() ? [] : [
        button(t, `batch-send-${index}`, sendLabel, () => this.submit(card), Boolean(card.confirmation)),
      ]));
  }

  render() {
    const t = theme();
    const sections = [];
    if (this.loading || !this.groups.length) {
      sections.push(div().text_color(t.muted)
        .child(this.loading ? "Reading blocked agents…" : "No blocked agents with a batch reply prompt."));
    }
    sections.push(...this.groups.map((card) => this.card(t, card)));
    for (const [heading, agents] of [
      ["Answer these in the inbox", this.forms],
      ["Prompt unavailable", this.unavailable],
    ]) {
      if (!agents.length) continue;
      sections.push(v_flex().flex_none().gap(6)
        .child(div().font_semibold().child(heading))
        .children(agents.map((a) => div().text_color(t.muted).child(label(a)))));
    }
    return v_flex().size_full().p(18).gap(12).bg(t.popover).text_color(t.foreground).text_size(12)
      .child(h_flex().flex_none().items_center().gap(8)
        .child(div().flex_1().text_size(15).font_semibold().child("Batch reply"))
        .child(button(t, "batch-close", "Close", () => closeOverlay(props().overlay))))
      .child(v_flex().id("batch-body").flex_1().min_h(0).overflow_y_scrollbar().pr(6).gap(10)
        .children(sections));
  }
}
