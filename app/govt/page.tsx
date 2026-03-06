"use client"

import { useAuth } from "@/lib/mock-auth"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader } from "@/components/ui/loader"
import { Button } from "@/components/ui/button"
import { Users, Crown, MapPin, Activity, CalendarClock, ShieldCheck, Download } from "lucide-react"
import dynamic from 'next/dynamic'

const AttractionsMap = dynamic(() => import('@/components/ui/map-view'), {
    ssr: false,
    loading: () => <div className="min-h-[350px] bg-stone-900 animate-pulse rounded-2xl w-full flex items-center justify-center text-stone-500 font-mono text-sm">Inicializando Módulo Geoespacial en Vivo...</div>
})

export default function GovtPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const [metrics, setMetrics] = useState({
        totalUsers: 0,
        totalBadges: 0,
        totalRedemptions: 0
    })
    const [topAttractions, setTopAttractions] = useState<any[]>([])
    const [allAttractions, setAllAttractions] = useState<any[]>([])
    const [scanCounts, setScanCounts] = useState<Record<string, number>>({})
    const [loadingMetrics, setLoadingMetrics] = useState(true)

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/govt/login')
                return
            }
            if (user.role !== 'govt' && user.role !== 'superadmin') {
                router.push('/passport')
                return
            }
            fetchAllMetrics()
        }
    }, [user, isLoading, router])

    const downloadCSV = async () => {
        try {
            // Re-fetch raw anon metrics (avoiding memory bloat earlier)
            let exportQuery = supabase.from('user_badges').select('user_id, attraction_id, earned_at')
            if (user?.role === 'govt' && allAttractions.length > 0) {
                exportQuery = exportQuery.in('attraction_id', allAttractions.map(a => a.id))
            }

            const { data: rawBadges } = await exportQuery

            if (!rawBadges || rawBadges.length === 0) {
                alert("No hay datos para exportar")
                return
            }

            let csvContent = "data:text/csv;charset=utf-8,"
            csvContent += "UUID_Usuario,Atraccion_ID,Atraccion_Nombre,Fecha_Hora\n" // Encabezados anonimizados

            rawBadges.forEach(row => {
                const attrName = allAttractions.find(a => a.id === row.attraction_id)?.name || row.attraction_id
                csvContent += `${row.user_id},${row.attraction_id},"${attrName}",${row.earned_at}\n`
            })

            const encodedUri = encodeURI(csvContent)
            const link = document.createElement("a")
            link.setAttribute("href", encodedUri)
            link.setAttribute("download", `Reporte_Inteligencia_${new Date().toISOString().split('T')[0]}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (e) {
            console.error("Error generando CSV:", e)
        }
    }

    const fetchAllMetrics = async () => {
        try {
            // First get valid attractions for this user/municipality
            let attractionsQuery = supabase.from('attractions').select('id, name, latitude, longitude')
            if (user?.role === 'govt' && user?.municipalityId) {
                attractionsQuery = attractionsQuery.eq('municipality_id', user.municipalityId)
            }
            const { data: localAttractions } = await attractionsQuery
            const validAttractionIds = localAttractions ? localAttractions.map(a => a.id) : []

            let usersCount = 0;
            let badgesCount = 0;
            let redemptionsCount = 0;
            let recentBadges: any[] = [];

            // If superadmin or there are local attractions to query against
            if (user?.role === 'superadmin' || validAttractionIds.length > 0) {
                // 1. Total Unique Users
                let usersQuery = supabase.from('user_badges').select('user_id')
                if (user?.role === 'govt') {
                    usersQuery = usersQuery.in('attraction_id', validAttractionIds)
                }
                const { data: activeUsers } = await usersQuery
                usersCount = activeUsers ? new Set(activeUsers.map(b => b.user_id)).size : 0

                // 2. Total Badges Issued
                let badgesQuery = supabase.from('user_badges').select('*', { count: 'exact', head: true })
                if (user?.role === 'govt') {
                    badgesQuery = badgesQuery.in('attraction_id', validAttractionIds)
                }
                const { count: bCount } = await badgesQuery
                badgesCount = bCount || 0

                // 3. Total Redemptions
                let redemptionsQuery = supabase.from('user_badges').select('*', { count: 'exact', head: true }).not('redeemed_at', 'is', null)
                if (user?.role === 'govt') {
                    redemptionsQuery = redemptionsQuery.in('attraction_id', validAttractionIds)
                }
                const { count: rCount } = await redemptionsQuery
                redemptionsCount = rCount || 0

                // 4. Recent Badges for Maps
                let recentQuery = supabase.from('user_badges').select('attraction_id').limit(5000)
                if (user?.role === 'govt') {
                    recentQuery = recentQuery.in('attraction_id', validAttractionIds)
                }
                const { data: rb } = await recentQuery
                recentBadges = rb || [];
            }

            setMetrics({
                totalUsers: usersCount,
                totalBadges: badgesCount,
                totalRedemptions: redemptionsCount
            })

            // 5. Build Maps and Chart Data
            const counts: Record<string, number> = {}
            recentBadges.forEach(b => {
                counts[b.attraction_id] = (counts[b.attraction_id] || 0) + 1
            })
            setScanCounts(counts)
            setAllAttractions(localAttractions || [])

            if (localAttractions) {
                const ranking = Object.entries(counts)
                    .map(([id, count]) => {
                        const attr = localAttractions.find(a => a.id === id)
                        return {
                            id,
                            count,
                            name: attr?.name || id,
                            location: 'Punto Registrado'
                        }
                    })
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)

                setTopAttractions(ranking)
            }
        } catch (error) {
            console.error("Error fetching govt metrics:", error)
        } finally {
            setLoadingMetrics(false)
        }
    }

    if (isLoading || loadingMetrics) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <Loader text="Inicializando Centro de Mando..." />
            </div>
        )
    }

    if (!user || (user.role !== 'govt' && user.role !== 'superadmin')) {
        return null
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] p-6 relative overflow-hidden">
            {/* Ambient Background Glows para Gobierno (Esmeralda/Cian) */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-amber-600/5 rounded-full blur-[150px] pointer-events-none" />

            <div className="container max-w-7xl mx-auto space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-700">

                {/* Header Section */}
                <div className="glass-panel border-emerald-200 bg-white/50 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="bg-gradient-to-br from-emerald-100 to-amber-50 p-4 rounded-xl border border-emerald-200">
                            <ShieldCheck className="h-8 w-8 text-emerald-700" />
                        </div>
                        <div>
                            <p className="text-xs text-emerald-700/80 font-bold uppercase tracking-widest mb-1">
                                Centro de Mando Analítico
                            </p>
                            <h1 className="text-3xl font-bold tracking-tight text-stone-900 flex items-center gap-3">
                                Tablero Global <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-600 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-700"></span></span>
                            </h1>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-200 text-emerald-800 hover:bg-emerald-100 bg-white/80 flex items-center gap-2"
                            onClick={downloadCSV}
                        >
                            <Download className="h-4 w-4" /> Exportar a CSV
                        </Button>
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-3 w-3" /> Nivel: {user.role}
                        </span>
                    </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1: Total Turistas */}
                    <div className="glass-panel border-stone-200/50 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users className="h-16 w-16 text-amber-600" />
                        </div>
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-sm font-medium text-stone-600">Turistas Activos</p>
                                <h3 className="text-4xl font-bold text-stone-900 mt-2">{metrics.totalUsers}</h3>
                                <p className="text-xs text-amber-700/80 mt-2 font-mono uppercase tracking-wider">Billeteras Únicas</p>
                            </div>
                            <div className="bg-amber-100 p-3 rounded-xl border border-amber-200 shadow-sm mr-2">
                                <Users className="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Total Badges */}
                    <div className="glass-panel border-stone-200/50 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Crown className="h-16 w-16 text-emerald-600" />
                        </div>
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-sm font-medium text-stone-600">Insignias Otorgadas</p>
                                <h3 className="text-4xl font-bold text-stone-900 mt-2">{metrics.totalBadges}</h3>
                                <p className="text-xs text-emerald-700/80 mt-2 font-mono uppercase tracking-wider">Acuñaciones Globales</p>
                            </div>
                            <div className="bg-emerald-100 p-3 rounded-xl border border-emerald-200 shadow-sm mr-2">
                                <Crown className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Total Redemptions */}
                    <div className="glass-panel border-stone-200/50 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CalendarClock className="h-16 w-16 text-emerald-600" />
                        </div>
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-sm font-medium text-stone-600">Beneficios Canjeados</p>
                                <h3 className="text-4xl font-bold text-stone-900 mt-2">{metrics.totalRedemptions}</h3>
                                <p className="text-xs text-emerald-700/80 mt-2 font-mono uppercase tracking-wider">Interacción Económica</p>
                            </div>
                            <div className="bg-emerald-100 p-3 rounded-xl border border-emerald-200 shadow-sm mr-2">
                                <CalendarClock className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Ranking Table */}
                    <div className="glass-panel border-stone-200/50 rounded-3xl overflow-hidden flex flex-col">
                        <div className="px-6 py-5 border-b border-stone-200 bg-white/70 flex justify-between items-center backdrop-blur-md">
                            <h3 className="font-semibold text-stone-800 flex items-center gap-3">
                                <Activity className="h-5 w-5 text-emerald-600" />
                                Atracciones en Tendencia
                            </h3>
                            <span className="text-xs font-mono text-stone-600 bg-stone-100 px-2 py-1 rounded-md border border-stone-300">Últimos 500 registros</span>
                        </div>
                        <div className="p-0 bg-white/50 flex-1">
                            {topAttractions.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-stone-100 text-stone-600 font-medium text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 border-b border-stone-200">Ranking</th>
                                            <th className="px-6 py-4 border-b border-stone-200">Atracción</th>
                                            <th className="px-6 py-4 border-b border-stone-200 text-right">Mints</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-200/50">
                                        {topAttractions.map((attr, index) => (
                                            <tr key={attr.id} className="hover:bg-stone-100/50 transition-colors group">
                                                <td className="px-6 py-4 font-mono font-medium text-stone-500 group-hover:text-emerald-700 transition-colors">#{index + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-stone-800">{attr.name}</div>
                                                    <div className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                                                        <MapPin className="h-3 w-3" /> {attr.location}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg font-mono font-bold">
                                                        {attr.count}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                                    <Activity className="h-10 w-10 text-stone-300 mb-4" />
                                    <span className="text-stone-500 text-sm">Esperando datos en la red...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Heatmap Geoespacial En Vivo */}
                    <div className="glass-panel border-stone-200/50 rounded-3xl overflow-hidden flex flex-col">
                        <div className="px-6 py-5 border-b border-stone-200 bg-white/70 flex justify-between items-center backdrop-blur-md">
                            <h3 className="font-semibold text-stone-800 flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-amber-600" />
                                Módulo de Calor Geoespacial (En Vivo)
                            </h3>
                            <span className="text-xs font-mono text-amber-800 bg-amber-100 px-2 py-1 rounded-md border border-amber-200">Registros On-Chain</span>
                        </div>
                        <div className="flex-1 min-h-[350px] flex flex-col items-center justify-center bg-stone-100/50 relative overflow-hidden">
                            <div className="w-full h-full min-h-[400px]">
                                <AttractionsMap attractions={allAttractions} scanCounts={scanCounts} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
