# Where this model sits

There are established vocabularies for audiovisual content, and this model touches several
of them. This page says which, how our concepts line up with theirs, what they model that we
do not, and what is ours alone.

The relation is worth stating plainly first. **They are metadata standards; this is a domain
model for a tool.** A standard describes a finished resource so it can be exchanged,
archived, broadcast or embedded; this model describes a production as it is being made, with
its rules. So the two meet on the *resource* and the *publication* — and part company on the
*editing*.

## The vocabularies

| vocabulary | what it is | why it is here |
|---|---|---|
| [W3C Ontology for Media Resources 1.0](https://www.w3.org/TR/mediaont-10/) (`ma-ont`) | a core vocabulary of media properties, with mappings to a dozen metadata formats | the closest general one; a media resource with `fragment` and `namedFragment` |
| [EBUCore](https://www.ebu.ch/metadata/ontologies/ebucore/ebucore) + [EBU CCDM](https://www.ebu.ch/metadata/ontologies/ccdm/ccdm) | the EBU's audiovisual metadata — *a rich extension of `ma-ont`* — with its Class Conceptual Data Model | the broadcast industry's, and the one a production tool would most likely exchange with |
| [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) (`oa`) | annotations over web resources: a body, a target, and selectors | our annotation family maps onto it closely |
| [W3C Media Fragments URI 1.0](https://www.w3.org/TR/media-frags/) | addressing a temporal (`t=`) or spatial (`xywh`) part of media | our `Span` and crop map onto it exactly |
| [schema.org](https://schema.org/VideoObject) (`VideoObject`, `Clip`, `CreativeWork`) | web-scale types for content and its embedding | the publishing side; `Clip` carries `startOffset`/`endOffset` |
| [PROV-O](https://www.w3.org/TR/prov-o/) | provenance: Entity, Activity, Agent and their relations | our take → clip → file derivation |

Others are adjacent but not used here: MPEG-7 and MPEG-21 (content description),
Dublin Core (general metadata), PBCore (US public media), IPTC Video Metadata Hub, and
FRBR (abstraction levels, below).

## Where we line up

| our concept | the standard term | relation |
|---|---|---|
| [[clip]] | `schema:VideoObject` / `schema:Clip`; `ebucore:EditorialObject` + `ebucore:MediaResource` | close — but ours is one level, the standard splits the work from its media |
| [[take]] | `ebucore:MediaResource`; `schema:MediaObject` | close — a take is one media resource |
| [[span]] | media fragments temporal `t=a,b` | **exact** — both are the half-open interval `[a, b)` |
| [[crop-region]] | media fragments spatial `xywh` | **exact** — a rectangle as fractions of the frame |
| [[annotation]] | `oa:Annotation` (`body`, `target`, `SpecificResource`) | close — the base maps; our kinds are bodies |
| an annotation's geometry | `oa:SvgSelector` / `oa:DataPositionSelector` | close — we hold fractions where they hold SVG |
| [[sound-annotation]] | `oa:Annotation` with a `Sound` body and an `oa:TimeState` | close |
| [[export-plan]], [[segment]] | `schema:Clip` (`startOffset`/`endOffset`); `ebucore:MediaFragment` | close — ours is a *plan of pieces*, they are fragments |
| [[publication]], [[publish-to-bluesky]] | `schema:PublicationEvent`; `ebucore:PublicationEvent` | close — but ours is an action, theirs an event with a time and a channel |
| [[export-target]], [[export-resolution]] | `ma:format`, `ma:compression`, `ma:frameSize`; `schema:encodingFormat`, `width`/`height` | close |
| [[project]] | `schema:CreativeWorkSeries`; `ma:collection` | partial — ours is a body of work *and its reason* |
| [[creator]] / [[ai-agent]] | `prov:Agent` (`Person` / `SoftwareAgent`); `schema:Person` | close |
| [[audience]] | `schema:Audience`; `ma:targetAudience` | close — and we model it least |
| take → clip → file | `prov:wasDerivedFrom`, `prov:wasGeneratedBy`, `prov:used` | close — our provenance is implicit in the aggregate |

## What the standards model that we do not

A production tool can ignore most of this; a metadata standard cannot. It is the list to
reach for if the app ever writes or reads content metadata:

- **Rights and licensing** — `ma:copyright`, `ma:policy`, `schema:license`, `oa` rights.
- **Contributors and roles** — `ma:contributor`/`creator` with a role, `schema:actor`/
  `director`/`producer`. We model one [[creator]] and nothing else.
- **Language, captions, transcripts** — `ma:language`, `schema:caption`/`transcript`.
- **Technical essence** — codec (`ma:compression`), frame rate, sampling rate, bitrate,
  tracks (`ma:numTracks`), which `EBUCore` carries in full. We hold resolution and container.
- **Identifiers** — `ma:identifier`, `schema:identifier`, EIDR / ISAN.
- **Publication as an event** — a time, a channel, a service (`schema:PublicationEvent`).
- **Series, season, episode** — `schema:partOfSeries`/`Season`/`Episode`; `EBUCore` has them.
- **Genre, rating, audience classification** — `ma:genre`, `ma:rating`, `ma:targetAudience`.
- **Location** — where it was made, `ma:location`, `schema:locationCreated`.

Two of these are the same gaps the [problem domain](problem-domain.md) already names: the
**audience** and **rights**. The rest are the concerns of a distributor, not a maker.

## What is ours alone

- **The editing algebra.** A clip's cuts are a [[spanset]] of half-open [[span]]s, and
  [[timeline-map]] converts between recording time and kept time. Standards have fragments
  and clips, but no algebra of removed ranges with a kept-time mapping — this is the part
  with the least to borrow.
- **A production environment as a lock.** A [[profile]] declares the items it *controls* and
  freezes them; no standard has this, because no standard is a tool.
- **Branding as clip properties.** The [[logo]], the [[watermark]] and the [[title-card]] are
  [[clip-property]], not metadata fields.- **The round trip.** The [[sidecar]] carries annotations beside a file and brings them back.
- **Being driven.** The [[automation-surface]] and its [[operation]]s.

## A note on levels

`ma-ont` deliberately refuses to distinguish a work from its encodings; `FRBR` does, as
work / expression / manifestation / item; `EBUCore` and `schema.org` sit in between. This
model is **one level** — the [[clip]] is the thing, and its takes are its parts. If we ever
needed to align, the mapping would be: [[production]] → *work*, [[clip]] → *expression*,
[[output]] → *manifestation*, the file → *item*.

## What to do with it

Nothing, until there is a reason to exchange. The anchors, if that day comes: **media
fragments** for [[span]] and [[crop-region]], **`oa`** for [[annotation]], **`ma-ont`** or
**`EBUCore`** for the resource and the publication, **schema.org** for the web side, and
**PROV-O** for the derivation. Recording those as `closeMatch` links in
[`ontology.jsonld`](ontology.jsonld) is the smallest step that would make the alignment
explicit and machine-readable.
