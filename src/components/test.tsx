"use client"

import { Label, Pie, PieChart } from "recharts"

import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { useEffect, useState } from "react"
import { NeonService } from "@/services/neon-service"

export const description = "A donut chart with text"



export function DatabaseStorage() {

    const [size, setSize] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);


    const limitMB = 512; // Límite de Neon para este proyecto
    const usedMB = size;
    const availableMB = limitMB - usedMB;
    const percentage = (usedMB / limitMB) * 100;


    const chartData = [
        { name: 'Usado', value: usedMB, fill: '#000000' },
        { name: 'Disponible', value: availableMB, fill: '#e5e7eb' },
    ];

    const chartConfig = {
        usado: {
            label: 'Usado',
            color: '#3b82f6',
        },
        disponible: {
            label: 'Disponible',
            color: '#e5e7eb',
        },
    } satisfies ChartConfig


    useEffect(() => {
        const fetchSize = async () => {
            try {
                const neonService = new NeonService();
                const usedStorage = await neonService.getNeonStorageUsed();
                setSize(usedStorage);
            } catch (err) {
                setError('Error fetching storage usage');
                console.error(err);
            }
        };

        fetchSize();
    }, []);

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-xl font-semibold mb-4">Almacenamiento</h3>
                <p className="text-red-500">Error: {error}</p>
                <p className="text-sm text-gray-500 mt-2">Revisa la consola del navegador para más detalles.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-xl font-semibold mb-4">Almacenamiento</h3>
            <div className="flex justify-center items-center">
                <div className="w-full max-w-xs">
                    <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square max-h-[250px]"
                    >
                        <PieChart>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={60}
                                strokeWidth={5}
                            >
                                <Label
                                    content={({ viewBox }) => {
                                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                            return (
                                                <text
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                >
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        className="fill-foreground text-3xl font-bold"
                                                    >
                                                        {percentage.toFixed(1)}%
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 24}
                                                        className="fill-muted-foreground"
                                                    >
                                                        Usado
                                                    </tspan>
                                                </text>
                                            )
                                        }
                                    }}
                                />
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    <div className="flex justify-center space-x-4 text-xs">
                        <div className="flex items-center">
                            <div className="w-3 h-3 bg-black rounded mr-2"></div>
                            <span>Usado: {usedMB.toFixed(2)} MB</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-3 h-3 bg-gray-300 rounded mr-2"></div>
                            <span>Disponible: {availableMB.toFixed(2)} MB</span>
                        </div>
                    </div>
                </div>
               
            </div>
        </div>
    )
}
