import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre + OpenFreeMap: token-free, no account, free for any use.
// Positron is visually equivalent to the Mapbox light style used previously.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const hubs = [
{
  name: "David Lloyd Ipswich",
  tagline: "Premium Rackets Facility",
  description: "6 indoor courts, 3 outdoor courts, progressive junior programme & extensive fitness suite.",
  coords: [1.1879, 52.0638] as [number, number],
  path: "/venues/david-lloyd"
},
{
  name: "Ipswich Sports Club",
  tagline: "Community Rackets & Sports Club",
  description: "3 indoor courts, 7 outdoor courts, 3 bubble courts, active junior programme & competitive match play.",
  coords: [1.1635, 52.0565] as [number, number],
  path: "/venues/ipswich-sports-club"
},
{
  name: "Culford Sports & Tennis Centre",
  tagline: "LTA Regional Player Development Centre",
  description: "6-court indoor centre, 7 outdoor courts, S&C suite, integrated school performance programme.",
  coords: [0.7342, 52.3108] as [number, number],
  path: "/venues/culford"
}];


const feederClubs = [
{
  name: "East Bergholt Tennis Club",
  tagline: "Award-Winning Community Club",
  description: "3 floodlit hardcourts, LTA coaching programmes for all ages, and a welcoming community club.",
  coords: [1.0485, 51.9725] as [number, number],
  path: "/clubs/east-bergholt"
},
{
  name: "Newmarket Tennis Club",
  tagline: "Community Tennis Since 1948",
  description: "7 premium courts including 3 with winter air hall, floodlit ITF-rated synthetic clay courts.",
  coords: [0.4050, 52.2440] as [number, number],
  path: "/clubs/newmarket"
},
{
  name: "Stowmarket Lawn Tennis Club",
  tagline: "Tennis for All",
  description: "5 resurfaced hardcourts with winter airdome, 4 pickleball courts, strong juniors section.",
  coords: [1.0000, 52.1890] as [number, number],
  path: "/clubs/stowmarket"
},
{
  name: "Felixstowe Lawn Tennis Club",
  tagline: "Bringing Tennis Since 1884",
  description: "Historic club with floodlit courts, Makeaball Tennis Academy coaching for all ages.",
  coords: [1.3510, 51.9630] as [number, number],
  path: "/clubs/felixstowe"
},
{
  name: "Woodbridge Tennis Club",
  tagline: "All Year Round Tennis",
  description: "6 all-weather floodlit courts, coaching programmes, and competitive match play.",
  coords: [1.2680, 52.0940] as [number, number],
  path: "/clubs/woodbridge"
},
{
  name: "Framlingham College",
  tagline: "Sports Centre & Tennis Programme",
  description: "Premium sports centre with tennis facilities, fitness suite, and coaching for all ages within Framlingham College grounds.",
  coords: [1.2870, 52.2220] as [number, number],
  path: "/clubs/framlingham"
}];


const TENNIS_BALL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="14" fill="#c8e620" stroke="#a0b800" stroke-width="1.5"/>
  <path d="M6 8 C12 14, 12 18, 6 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <path d="M26 8 C20 14, 20 18, 26 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const FEEDER_BALL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="14" fill="#1565c0" stroke="#0d47a1" stroke-width="1.5"/>
  <path d="M6 8 C12 14, 12 18, 6 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  <path d="M26 8 C20 14, 20 18, 26 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
</svg>`;

const SuffolkMapSection = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE_URL,
        center: [1.0, 52.18],
        zoom: 9,
        pitch: 20,
        attributionControl: false
      });
    } catch (error) {
      // Never let a map failure take down the page — the venue legends
      // below the map carry the same information.
      console.error("Failed to initialise map", error);
      setMapFailed(true);
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", async () => {
      try {
        const res = await fetch("https://raw.githubusercontent.com/glynnbird/ukcountiesgeojson/master/suffolk.geojson");
        const suffolkBoundary = await res.json();
        map.addSource("suffolk-boundary", { type: "geojson", data: suffolkBoundary });
      } catch {
        console.warn("Failed to load Suffolk boundary");
      }

      map.addLayer({
        id: "suffolk-fill",
        type: "fill",
        source: "suffolk-boundary",
        paint: { "fill-color": "#00b8d4", "fill-opacity": 0.08 }
      });

      map.addLayer({
        id: "suffolk-border",
        type: "line",
        source: "suffolk-boundary",
        paint: { "line-color": "#00b8d4", "line-width": 2.5, "line-opacity": 0.6, "line-dasharray": [3, 2] }
      });

      hubs.forEach((hub) => {
        const markerEl = document.createElement("div");
        markerEl.className = "suffolk-map-marker";
        markerEl.innerHTML = TENNIS_BALL_SVG;
        markerEl.style.cssText = `width: 40px; height: 40px; cursor: pointer; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));`;

        markerEl.addEventListener("mouseenter", () => setActiveHub(hub.name));
        markerEl.addEventListener("mouseleave", () => setActiveHub(null));
        markerEl.addEventListener("click", () => navigate(hub.path));

        const popup = new maplibregl.Popup({
          offset: 30, closeButton: false, closeOnClick: false, className: "suffolk-map-popup"
        }).setHTML(`
          <div style="padding: 12px 16px; max-width: 260px;">
            <h4 style="font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 15px; margin: 0 0 2px; color: #0f1c2e;">${hub.name}</h4>
            <p style="font-family: 'Outfit', sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #00b8d4; margin: 0 0 8px; font-weight: 600;">${hub.tagline}</p>
            <p style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: #546e7a; margin: 0; line-height: 1.5;">${hub.description}</p>
          </div>
        `);

        markerEl.addEventListener("mouseenter", () => popup.addTo(map));
        markerEl.addEventListener("mouseleave", () => popup.remove());

        new maplibregl.Marker({ element: markerEl }).setLngLat(hub.coords).setPopup(popup).addTo(map);
      });

      feederClubs.forEach((club) => {
        const markerEl = document.createElement("div");
        markerEl.className = "suffolk-map-marker-feeder";
        markerEl.innerHTML = FEEDER_BALL_SVG;
        markerEl.style.cssText = `width: 28px; height: 28px; cursor: pointer; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));`;

        markerEl.addEventListener("click", () => navigate(club.path));

        const popup = new maplibregl.Popup({
          offset: 20, closeButton: false, closeOnClick: false, className: "suffolk-map-popup"
        }).setHTML(`
          <div style="padding: 10px 14px; max-width: 240px;">
            <h4 style="font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 14px; margin: 0 0 2px; color: #0f1c2e;">${club.name}</h4>
            <p style="font-family: 'Outfit', sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #1565c0; margin: 0 0 6px; font-weight: 600;">${club.tagline}</p>
            <p style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #546e7a; margin: 0; line-height: 1.4;">${club.description}</p>
          </div>
        `);

        markerEl.addEventListener("mouseenter", () => popup.addTo(map));
        markerEl.addEventListener("mouseleave", () => popup.remove());

        new maplibregl.Marker({ element: markerEl }).setLngLat(club.coords).setPopup(popup).addTo(map);
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [navigate]);

  return (
    <section id="map" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10">
          <span className="text-lta-cyan font-display font-semibold text-sm uppercase tracking-widest">Our Locations</span>
          <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mt-3">
            Across <span className="text-lta-cyan">Suffolk</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mt-4 text-lg font-body">
            Three strategically located performance hubs covering the county alongside several amazing local feeder clubs.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl overflow-hidden border border-lta-cyan/20 shadow-[var(--shadow-glow-blue)]"
          style={{ height: mapFailed ? "auto" : "650px" }}>
          {mapFailed ? (
            <div className="w-full py-16 flex items-center justify-center bg-card">
              <p className="text-muted-foreground font-body text-sm">
                Interactive map unavailable — explore our venues below.
              </p>
            </div>
          ) : (
            <div ref={mapContainer} className="w-full h-full" />
          )}
        </motion.div>

        {/* Hub legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8">
          <h3 className="font-display font-bold text-foreground text-sm mb-3 flex items-center gap-2">
            <div className="w-5 h-5 shrink-0">
              <svg width="20" height="20" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="#c8e620" stroke="#a0b800" strokeWidth="1.5" />
                <path d="M6 8 C12 14, 12 18, 6 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M26 8 C20 14, 20 18, 26 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            Lead Venues
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hubs.map((hub) =>
            <Link
              key={hub.name}
              to={hub.path}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
              activeHub === hub.name ?
              "border-lta-cyan/60 bg-lta-cyan/10" :
              "border-border bg-card hover:border-lta-cyan/30"}`
              }>
              <div className="w-10 h-10 shrink-0">
                <svg width="40" height="40" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="14" fill="#c8e620" stroke="#a0b800" strokeWidth="1.5" />
                  <path d="M6 8 C12 14, 12 18, 6 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M26 8 C20 14, 20 18, 26 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h4 className="font-display font-bold text-foreground text-sm">{hub.name}</h4>
                <p className="font-body text-xs text-muted-foreground">{hub.tagline}</p>
              </div>
            </Link>
            )}
          </div>
        </motion.div>

        {/* Feeder clubs legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-4">
          <h3 className="font-display font-bold text-foreground text-sm mb-3 flex items-center gap-2">
            <div className="w-5 h-5 shrink-0">
              <svg width="20" height="20" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="12" fill="#1565c0" stroke="#0d47a1" strokeWidth="1.5" />
                <path d="M5 7 C10 12, 10 16, 5 21" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M23 7 C18 12, 18 16, 23 21" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            Feeder Clubs
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {feederClubs.map((club) =>
            <Link
              key={club.name}
              to={club.path}
              className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-300">
                <div className="w-7 h-7 shrink-0">
                  <svg width="28" height="28" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="12" fill="#1565c0" stroke="#0d47a1" strokeWidth="1.5" />
                    <path d="M5 7 C10 12, 10 16, 5 21" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M23 7 C18 12, 18 16, 23 21" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-display font-bold text-foreground text-xs">{club.name}</h4>
                  <p className="font-body text-[10px] text-muted-foreground">{club.tagline}</p>
                </div>
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </section>);
};

export default SuffolkMapSection;
