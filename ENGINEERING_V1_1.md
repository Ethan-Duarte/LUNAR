# LUNAR 1.1 engineering preview

This is a runnable checkpoint of the next-version program, not completion of the entire parity roadmap. Main and the public V1.0 deployment have not been changed by this work.

## Start and inspect

On the website, select Advanced → Base. Basic deliberately emphasizes Observe and Sites. The left panel can be resized on desktop.

1. Load the electrical tutorial. It intentionally co-locates a habitat and array to isolate the power calculation. Its permissive slope limit and disabled Earth requirement are tutorial settings, not mission requirements.
2. Evaluate design. Read generated energy, unmet demand, battery reserve, Earth availability and all constraints.
3. Select the array, click Move on map / terrain, then click its new position. Or edit latitude/longitude numerically. Facility edits support undo/redo.
4. Add one relay. Set its height, leave exactly that relay movable, and Test tower heights. The sweep checks discrete heights, not the exact continuous minimum.
5. Fix habitat/resource anchors, choose one to three movable components, set search radius and constraints, and Search nearby layouts. It samples the centre and eight boundary positions of a circular region. At most 243 deterministic combinations are screened at 2° azimuth; the top three are checked at 0.5°. Array proportions on the shortlist are resized against the current battery capacity. No guarantee of a global optimum.
6. Test placement sensitivity to sample the centre and eight common offsets. This is neither a landing probability nor an elevation-error confidence interval.
7. Save complete base project. Exports preserve components, engineering settings, start time, scientific criteria and the report. Import restores inputs and asks you to recalculate; archived results are not silently represented as current.

Three-dimensional lines appear after evaluation and show the tested straight connections within the selected range. Green means terrain-clear; blocked/unknown links are dashed. Lines are drawn through terrain for inspection, so consult their status rather than inferring clearance from the picture. The Base map and table show the same links. The selected-observer remesh uses the same elevation lookup chain and adds no measured resolution. These visual changes still need hardware-browser acceptance.

## Electrical model

At each left-edge time sample:

`P = area × solar flux at 1 AU × efficiency × derating × terrain-visible fraction × eclipse-visible fraction × incidence / Sun-distance(AU)^2`

Tracking means ideal two-axis incidence = 1. Horizontal panels use max(0, sin(solar elevation)). There is no temperature-dependent efficiency, dust, degradation, terrain-reflected light or mechanical tracking limit. Nominal 1361 W/m² is configurable; the supplied ephemeris supplies changing Sun distance.

Demand is constant base load plus constant component loads. Generation serves demand first. Excess charges storage at the selected charge efficiency and is curtailed when full. Deficits discharge at the selected discharge efficiency; any remaining deficit is unmet demand. Usable capacity, initial state of charge and required reserve are explicit inputs. State of charge is integrated with a bounded storage state.

Energy conservation check:

`generation + initial stored energy = served load + final stored energy + charge losses + discharge losses + curtailed energy`

Battery sizing finds the minimum capacity within the numerical search range that supports the finite mission at the stated initial SOC and reserve. A charged battery is not recurring free energy. This is not a repeating-cycle or long-term sustainability claim. Array sizing changes areas in their current proportions for the existing battery. It does not jointly optimize lifecycle cost, voltage, mass or repeating-cycle energy balance.

Power facilities share an ideal bus only if habitat/power/relay nodes connect through clear straight corridors under the link-distance limit. Cable loss is a user-specified fractional loss/km along shortest clear corridors to the first habitat. Actual cable routing, network voltage and power-flow constraints are absent. Radio paths use habitat/relay nodes only.

## Eclipses

The browser now uses analytic two-circle overlap rather than the earlier linear partial-eclipse ramp. Terrain and eclipse fractions are combined as a product; exact overlapping masks and atmospheric transmission remain omitted. The report separates eclipse intervals, lost generation, incremental unmet demand and capacity with/without eclipses. A solar eclipse does not automatically interrupt radio contact.

Time samples can miss a short interval or place a contact within one bin. Five-minute sampling is offered; no independent contact-time accuracy is claimed. Archived Python study JSONs retain their older models.

## Communications

Geometric Earth contact means Earth's centre clears the terrain by the selected mask. A habitat can reach Earth through another habitat/relay with a clear path, within the maximum link distance.

The optional RF gate uses:

`FSPL(dB) = 92.447783 + 20 log10(distance km) + 20 log10(frequency GHz)`

`received dBW = transmit dBW + transmit gain + receive gain − FSPL − fixed losses`

`Eb/N0 = received dBW − 10 log10(k × noise temperature) − 10 log10(bit rate)`

The selected required Eb/N0 is subtracted to give margin. Earth receiver gain is separate from surface receiver gain. This simplified free-space model omits Fresnel-zone clearance, diffraction, pointing, polarization, atmospheric/weather losses beyond the user lumped loss, station geometry and scheduling. It is not a DSN service prediction.

## Terrain and feasibility

Slopes use available terrain; global fallback slopes are coarse. The present slope check concerns facility centres, not full array foundations or pad footprints. Terrain LOS is sampled every 20 m, capped at 10,000 segments; source resolution remains the limiting detail. Sampled clearance is not an error bound.

Every selected constraint is checked again on the shortlisted design. Failed requirements remain visible. Earth-dependent recommendations are provisional while the fixed Earth-map holdout discrepancy is unresolved.

## References

- NASA LOLA/Kaguya terrain products: https://pgda.gsfc.nasa.gov/products/54 and https://pgda.gsfc.nasa.gov/products/90
- NASA total solar irradiance background: https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/science
- JPL DSN telecommunications design handbook: https://deepspace.jpl.nasa.gov/dsndocs/810-005/
- NASA/JPL SPICE: https://naif.jpl.nasa.gov/naif/

References explain physical inputs and conventions; they do not endorse this implementation.
