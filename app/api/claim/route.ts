import { NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Helper matemático para Distancias de Coordenadas de la Tierra
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d * 1000; // Returns meters
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

// ABI mínimo para ejecutar la función generada en el Smart Contract
const ABI = [
    "function mintInsignia(address tourist, uint256 attractionId) public"
];

export async function POST(request: Request) {
    try {
        const { userId, attractionId, walletAddress, userLat, userLng } = await request.json()

        if (!userId || !attractionId) {
            return NextResponse.json({ error: 'Missing userId or attractionId' }, { status: 400 })
        }

        // ---------- GEOFENCING VALIDATION (US 2.2) ----------
        if (userLat === undefined || userLng === undefined) {
            return NextResponse.json({ error: 'Coordenadas GPS requeridas para evitar Fraudes.' }, { status: 403 })
        }

        const { data: attractionData, error } = await supabase
            .from('attractions')
            .select('latitude, longitude')
            .eq('id', attractionId)
            .single()

        if (error || !attractionData) {
            return NextResponse.json({ error: 'Attraction not found for geolocation check.' }, { status: 404 })
        }

        if (attractionData.latitude && attractionData.longitude) {
            const distance = getDistanceFromLatLonInM(userLat, userLng, attractionData.latitude, attractionData.longitude);
            if (distance > 100) {
                return NextResponse.json({ error: 'Estás a más de 100m de distancia del lugar oficial. Fraude Detectado.' }, { status: 403 })
            }
        }
        // ---------- END GEOFENCING ----------

        // ---------- WEB3 MINTING (GASLESS FOR TOURIST) ----------
        let transactionHash = null;
        if (walletAddress && process.env.ADMIN_PRIVATE_KEY && process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS) {
            try {
                console.log(`Initiating Web3 Minting for Wallet: ${walletAddress} via Ethers.js`);

                // Conectando al nodo Alchemy RPC
                const provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);

                // Instanciando la cuenta administradora
                const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

                // Conectando el contrato
                const contract = new ethers.Contract(process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS, ABI, adminWallet);

                // Mapeo básico de ID de atracción a Token ID en blockchain
                let tokenId = 0;
                if (attractionId === 'cataratas') tokenId = 1;
                else if (attractionId === 'obelisco') tokenId = 2;

                // Sincronizar dinámicamente el nonce pendiente actual para evitar colisiones
                const currentNonce = await provider.getTransactionCount(adminWallet.address, "pending");

                // Ejecutar transacción delegada pidiendo auto-gas-estimation a Alchemy
                const tx = await contract.mintInsignia(walletAddress, tokenId, {
                    nonce: currentNonce
                });
                const receipt = await tx.wait(); // Esperar minado en un bloque

                transactionHash = receipt?.hash || tx.hash;
                console.log(`Ethers Minting successful. Tx: ${transactionHash}`);
            } catch (web3error) {
                console.error("Web3 Minting Error:", web3error);
                // We don't block DB insertion if Web3 fails, ensuring the MVP works gracefully without gas.
            }
        } else {
            console.log("Web3 Minting skipped: Missing wallet or Admin Keys in .env");
        }

        return NextResponse.json({
            success: true,
            transactionHash,
            message: "Airdrop processed (or skipped if wallet/keys missing)."
        })

    } catch (err) {
        console.error("API error:", err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
