# Website UI primitives

## Choose by purpose

| Component | Use | Contract |
| --- | --- | --- |
| TextLink | A destination inside prose | Native anchor, inline underline; no button padding |
| NavLink | Site/section navigation | Native anchor, opaque text marker; unchanged weight |
| Tabs | Switch adjacent panels | Unique instance id, controlled value, arrows/Home/End; skips disabled items |
| Toolbar | A related group of commands | One Tab stop, arrows/Home/End move without activating; native buttons |
| TextField | Short text or search | Required id/label, native attributes, bindable value, linked hint/error |
| TextArea | Multiline editing | Required id/label, native attributes, resize vertically, 16px-equivalent input text |
| SelectField | One choice from a short known list | Native single select, string value, disabled options, linked hint/error |
| Checkbox | Independent boolean choice | Native input, bindable checked, full clickable label, form name/value |
| EmptyState | No result yet | Static title/description, optional actions snippet; no automatic alert or fake action |
| Notice | Context, result, or error | Icon and text; static by default, opt into live announcements for changes |

Tabs use automatic activation on focus for local, immediately available panels.
Only the selected panel's snippet is mounted: keep editable values in the parent.
Ids must be unique within a page and item values must be unique within an instance.
If selection disappears, the first enabled item is displayed. Empty items render no panel.
Toolbar actions also require unique ids. Arrow movement does not execute commands.

Header navigation uses NavLink. Playground uses Tabs, TextArea, Notice and Toolbar.
TextField and TextLink are demonstrated in the development reference, available for
future consumer forms/prose. Do not replace every anchor with LinkButton: reserve
that component for a genuinely emphasized navigation CTA.

SelectField and Checkbox are demonstrated under `#choices-title`; EmptyState also
serves the actual Playground preview before a diagram exists. SelectField deliberately
does not implement searchable, multiple, or object-valued selection. Native controls
retain platform keyboard behavior. Keep their state in the consumer with `bind:value`
or `bind:checked`, and supply unique ids. `field.ts` composes hint/error references
with caller-provided aria-describedby for all four field primitives. Hints/errors
have no browser-default paragraph margin; `.ui-field` owns their spacing.
Checkbox's label owns the target, while the native check mark stays small. EmptyState
is not a Notice: absence of content is not automatically an error or live announcement.

SelectField uses `select-field.css` to style both the control and `::picker(select)`
with `appearance: base-select` in supporting browsers. Options share the control's
inset and minimum target; selection uses a background without an additional checkmark.
Native selection, validation and form submission remain intact.
Unsupported browsers retain their native picker; identical cross-browser appearance
is not guaranteed. No hidden-input mirror, custom key handlers or popup dependency.
Reference: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select

Semantic UI's selection dropdown informs the connected control/picker boundary,
shared inset and state surfaces. The picker touches the field (one border overlap),
with the same active/error border. Both surfaces retain the kit's corner radius
without measuring popup placement in JavaScript. This is an adaptation,
not a port of its jQuery module: Svelte's bind:value remains the only selection state.
Source: https://github.com/Semantic-Org/Semantic-UI/blob/master/src/definitions/modules/dropdown.less

SelectField and the default Disclosure trigger share DropdownIndicator (Lucide
ChevronDown). Its dimensions and CSS-only open rotation live in dropdown-indicator.css.
The select's decorative sibling ignores pointer events; native arrows are suppressed
to prevent duplication. No additional open state is stored in Svelte. Non-supporting
pickers still use native behavior; open rotation depends on browser :open support.

The additional source is https://github.com/konoe-akitoshi/design-rules:
read the design skill, entry guide, foundations, actions/navigation/forms/feedback,
interaction/state guidance, tokens, color roles and prohibited patterns.
Apply its purpose → structure → interaction order, not a new universal shape.
The reference is a component catalogue; the marketing page and editor have different
jobs. The existing green brand and native disclosure semantics are retained. Tabs
and toolbars receive their full keyboard contracts rather than ARIA roles alone.
The supplied HTML-only design-lint is not run on Svelte files. This is not a claim
of compliance with every repository guideline (e.g. app-wide URL persistence).

Use `$lib/ui` for website controls. These are Svelte 5 native-element wrappers:
`$props`, typed `svelte/elements` attributes, callback event props and children snippets.
No application state is stored in modules; disclosure state belongs to each instance.

- `Button`: actions; defaults to `type="button"`. Native disabled, form and ARIA attributes pass through.
- `LinkButton`: navigation; requires href and stays an anchor (no fake disabled links).
- `IconButton`: Button with a required accessible label and icon-sized touch target.
- `Disclosure`: native details/summary for navigation or grouped actions, not an ARIA application menu. Tab/Shift+Tab navigate normally. Enter/Space toggles, Escape closes and restores focus when inside; outside clicks and action selection close it. `resetKey` closes on route changes.
- `Panel`: shared non-interactive surface. Compose headings/content through children; it does not imply a clickable card.
- `Notice`: a contextual note, not an enclosed card. `notice.css` owns a leading-sized
  icon column and one aligned text column. Icons are centered on the first line, not
  nudged with margin/transform. Title and description share a start edge. Tone uses
  the icon and leading rule; text/shape also identify the message. Static notes stay
  outside live regions; `live` retains status/alert semantics. Grid skill applied:
  shared tokens, line-box alignment, restrained grouping; no editorial harness used.

`ui.css` owns control sizes, spacing, radii and states. Colors consume the website's semantic theme tokens. Use variants (`primary`, `secondary`, `ghost`) and sizes (`default`, `large`, `icon`, `compact`) rather than overriding padding, radius or color at call sites. Layout classes remain with consumers. Use inline SVG/lucide snippets for icons.

Buttons do not use link underlines: primary has a filled surface, secondary a boundary,
and ghost is a supporting command with a surface on interaction. The former `link`
variant has been removed; use ghost for actions, TextLink for inline destinations,
or LinkButton for navigation CTAs. Hover is limited to hover-capable input; active
is separate from hover and focus. Disabled controls do not receive those states.
Ghost toggles/disclosure triggers retain a surface and boundary while pressed/open.
Keep a visible state label when the action needs one (see the preview toggle).
NavLink and Tabs use `selection-marker.css`: opaque green and white text on the label
for selection and hover, without changing font weight. `--ui-marker-inset` is 0.25rem;
outer padding subtracts that inset so label positions and target widths stay stable.
The marker does not fill the target's padding. Colors use `--ui-marker-bg/fg`.
Nonselected labels use `--site-muted` and stay unboxed. Hover intentionally uses the
same white-on-green treatment as selection; neither state changes weight.
Focus is a separate ring, with an outline fallback for selection in forced colors.
TextLink keeps its inline underline. Navigation and tab semantics remain unchanged.

Button review source: [design-fix](https://github.com/konoe-akitoshi/design-rules/blob/main/.claude/skills/design-fix/SKILL.md)
and [actions: Button / Button group / Link](https://github.com/konoe-akitoshi/design-rules/blob/main/guidelines/components/actions.md).
Applied the role/state distinction, not its illustrative palette, universal 48px sizing,
or automatic glyph translations. Existing compact geometry and green brand stay intact.
Underlines are not inherently outdated; this is a project decision to distinguish
commands from prose links, not a CSS or accessibility requirement.

Spacing uses a quarter-rem base, with half-rem grouping and 1.5rem section gaps. Controls have a 2.75rem minimum target; large controls are 3rem. Touch access and text wrapping take precedence over a rigid baseline. Decorative marketing illustrations remain domain components, not UI primitives.

Preview: `/ja/ui-preview` or `/en/ui-preview` on the dev server only (404 outside development). Check both themes, narrow widths, keyboard navigation, disabled controls, long labels and native form behavior. No Storybook or runtime UI dependency is required.

References:
- https://svelte.dev/docs/svelte/typescript#Typing-wrapper-components
- https://svelte.dev/docs/svelte/snippet
- https://svelte.dev/docs/kit/project-structure

## Visual discipline

This kit serves a network-documentation tool. Preserve the Shumoku mark and green
identifier. Filled green identifies primary actions and navigation text markers;
disabled controls are neutral.
Separate control boundaries (stronger contrast) from structural rules. Do not give
every piece of content an enclosing card: `Panel variant="ruled"` is for supporting
information, `outlined` for grouped tools. Only floating disclosures need shadows.

The reference page uses a four-column grid, shared subgrid edges, a half-rem rhythm
and two type sizes. Its sections use rules and whitespace rather than repeating cards.
At narrow widths the same hierarchy stacks; touch targets and translated text take
priority over strict baseline alignment. Large controls gain space, not a new type size.

Applied sources (original instructions read, not a wholesale style transplant):
- https://github.com/alex-hyperagent/hyperagent-public-skills/blob/main/skill-vignelli-canon-design-system.json
  — semantics, appropriateness, brand equity, color as identifier, type hierarchy and rules.
- https://github.com/alex-hyperagent/hyperagent-public-skills/blob/main/skill-muller-brockmann-grid-systems.json
  — shared grid edges, tokenized spacing and multi-width measurement.

Adaptations: retain the existing multilingual font stack and green brand instead of
forcing Helvetica/red; use rem-based tokens and readable line heights, not print units.
No image generation, publishing, signage, runtime glyph nudging or editorial overlay
is needed for these controls. The source token generators and editorial verification
harness are not run; browser measurements and interaction checks verify this UI instead.
