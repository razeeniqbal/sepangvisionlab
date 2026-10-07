# Milestone 24: steady labels, fixed tyres, and the real Sepang venue

## Driver labels no longer shake
drei's `<Html>` projected each tag during the frame, but before that frame's camera and car positions were applied. Every tag was drawn where its car had been one frame earlier, about 1–1.5 m at racing speed, so tags shook against their cars. Tags now live in one overlay that is positioned from the scene's after-render hook, once the camera and every car are final. The fade behind scenery also changes only when two checks in a row agree, so tags at the edge of a board no longer flicker.

## Tyres
- The white sidewall marks sat past the tyre's bulge and poked out like spikes. They now sit flat on the sidewall band.
- Rear tyres are 1.3 times wider than the fronts (real cars run 405 mm rears and 305 mm fronts). They grow outward from the hub.
- The speed-blur disc covers only the wheel face, not the tyre sidewall, and is darker and subtler.

## The venue, from the circuit's own description
Sources: sepangcircuit.com/architecture (accessed 2026-10-07) and spectator guides. Shapes are illustrative where the source gives no geometry. Each item is registered in `sepangSpatialReferences.ts`.

- **Pit building:** 33 garages, each 8 m wide and 24 m deep (sourced), on the ground floor. The paddock club sits behind glass on the first floor, suites are set back on the second, and a rooftop canopy reaches over the pit lane. The taller end blocks are illustrative.
- **Main grandstand:** double-fronted along the OFFICIAL east-west alignment, with stepped rows of spectators facing both straights. It sits under a row of white petal-shaped canopies on masts, after the hibiscus-inspired "umbrella shade" roof. The exact canopy geometry is not published.
- **K1 grandstand:** a covered stand on the outside of Turn 1, at the end of the main straight.
- **C2 hillstand:** a grass bank with spectators and a partial roof beside the Turns 9–11 complex.
- **Pit lane:** registered as DERIVED (from the 73 race pit stops).
- **Turn boards:** now show a plain back instead of mirrored numbers.

## Mouse camera control
- **Drag** orbits the camera around the car. Up and down raises or lowers it. Onboard, drag looks around (limited to ±1.2 rad) and up or down.
- **Scroll** zooms smoothly in proportion to the scroll: distance in Chase, Heli and Inspect, and the lens on TV.
- **Double-click** resets the view.
- A click that ends a drag no longer selects a car. The page never scrolls under the wheel. On touch, horizontal drags orbit while vertical swipes still scroll the page.

## Onboard camera steadied
The onboard view looked shaky for three reasons:
- a high-speed camera shake that is far too strong this close to the car;
- the car's own sprung body motion and road vibration, which a camera mounted on the car would not see;
- frame-to-frame heading jitter, magnified across the 40 m look-ahead.

Now:
- the onboard camera has no shake;
- the car you ride in is drawn rigid, though its wheels still steer and spin;
- the camera and that car share one lightly eased heading.

The chase camera keeps a smaller shake.
