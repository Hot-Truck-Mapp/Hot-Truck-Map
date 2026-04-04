'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase } from '../../lib/supabase/client'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [openNow, setOpenNow] = useState(true)

  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.0060, 40.7128],
      zoom: 12
    })

    map.current.on('load', () => {
      const img = new Image(40, 50)
      img.onload = () => {
        map.current!.addImage('truck-pin', img)
        loadTrucks()
        subscribeToUpdates()
      }
      img.src = '/images/truck-pin.svg'
    })
  }, [])

  useEffect(() => {
    if (!map.current) return
    refreshTrucks()
  }, [openNow])

  const loadTrucks = async () => {
    const { data: trucks } = await supabase
      .from('trucks')
      .select('*')
      .eq('is_active', true)
      .eq('is_open', true)

    if (!trucks || !map.current) return

    map.current.addSource('trucks', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: trucks.map((truck: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [truck.longitude, truck.latitude]
          },
          properties: {
            id: truck.id,
            name: truck.name,
            cuisine_type: truck.cuisine_type
          }
        }))
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    })

    map.current.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'trucks',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#FF6B35',
        'circle-radius': [
          'step', ['get', 'point_count'],
          20, 5, 30, 10, 40
        ]
      }
    })

    map.current.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'trucks',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 14
      },
      paint: { 'text-color': '#ffffff' }
    })

    map.current.addLayer({
      id: 'unclustered-point',
      type: 'symbol',
      source: 'trucks',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'truck-pin',
        'icon-size': 0.8,
        'icon-allow-overlap': true,
        'icon-anchor': 'bottom',
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': 11,
        'text-offset': [0, 0.5],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#333333',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      }
    })

    map.current.on('click', 'unclustered-point', (e) => {
      const features = e.features![0]
      const { name, cuisine_type } = features.properties!
      const coordinates = (features.geometry as any).coordinates

      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(`<h3>${name}</h3><p>${cuisine_type}</p>`)
        .addTo(map.current!)
    })

    map.current.on('click', 'clusters', (e) => {
      const features = map.current!.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      })
      const clusterId = features[0].properties!.cluster_id
      const source = map.current!.getSource('trucks') as mapboxgl.GeoJSONSource
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return
        map.current!.easeTo({
          center: (features[0].geometry as any).coordinates,
          zoom: zoom!
        })
      })
    })
  }

  const subscribeToUpdates = () => {
    supabase
      .channel('trucks-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trucks'
      }, () => {
        refreshTrucks()
      })
      .subscribe()
  }

  const refreshTrucks = async () => {
    let query = supabase
      .from('trucks')
      .select('*')
      .eq('is_active', true)

    if (openNow) {
      query = query.eq('is_open', true)
    }

    const { data: trucks } = await query
    if (!trucks || !map.current) return

    const source = map.current.getSource('trucks') as mapboxgl.GeoJSONSource
    if (!source) return

    source.setData({
      type: 'FeatureCollection',
      features: trucks.map((truck: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [truck.longitude, truck.latitude]
        },
        properties: {
          id: truck.id,
          name: truck.name,
          cuisine_type: truck.cuisine_type
        }
      }))
    })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
      }}>
        <button
          onClick={() => setOpenNow(!openNow)}
          style={{
            backgroundColor: openNow ? '#FF6B35' : '#ffffff',
            color: openNow ? '#ffffff' : '#FF6B35',
            border: '2px solid #FF6B35',
            borderRadius: '20px',
            padding: '8px 16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          🕐 Open Now
        </button>
      </div>
      <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />
    </div>
  )
}