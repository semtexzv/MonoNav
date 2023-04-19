import React, {useCallback, useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom/client';

import {useJsApiLoader} from '@react-google-maps/api';
import {usePlacesWidget} from "react-google-autocomplete";

import useAsyncEffect from "use-async-effect";
import {ensureConnected} from "./static/js/main.js";
import {replRawMode, replSend} from "./static/js/repl.js";
import {isConnected} from "./static/js/bluetooth.js";

import DEVICE_INIT from './static/py/init.py';

const LIBRARIES = ['places', 'routes'];

export const useCurrentLocation = (): GeolocationPosition | undefined => {
    const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | undefined>(undefined);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition((position: GeolocationPosition) => {
            setCurrentLocation(position);
        });
    }, []);

    return currentLocation;
};

interface Monocle {
    sendRepl: (txt: string) => Promise<void>,
    showText: (txt: string) => Promise<void>,
}

interface MonocleProps {
    device: Monocle;
}

const DEVICE = {
    sendRepl: async (txt: string) => {
        await replSend(txt + '\r')
    },
    showText: async (txt: string) => {
        function wordWrap(str: string, width: number, delimiter: string): string {
            // use this on single lines of text only

            if (str.length > width) {
                let p = width
                for (; p > 0 && str[p] != ' '; p--) {
                }
                if (p > 0) {
                    var left = str.substring(0, p);
                    var right = str.substring(p + 1);
                    return left + delimiter + wordWrap(right, width, delimiter);
                }
            }
            return str;
        }

        function multiParagraphWordWrap(str: string, width: number, delimiter: string) {
            // use this on multi-paragraph lines of text

            let arr = str.split(delimiter);

            for (let i = 0; i < arr.length; i++) {
                if (arr[i].length > width)
                    arr[i] = wordWrap(arr[i], width, delimiter);
            }

            return arr.join(delimiter);
        }

        const cleaned = txt.normalize('NFKD').replace(/[\u0300-\u036f]/g, "");
        const wrapped = wordWrap(cleaned, 28, '\n');
        const split = wrapped.split('\n')

        let command = ""
        for (let i = 0; i < split.length; i++) {
            if (i > 3) {
                continue;
            }
            command += `display.text("${split[i]}", 0, ${i * 50}, 0xFFFFFF);`
        }
        command += 'display.show(); gc.collect()';
        await replSend(command);
    }
};

function useMonocle(onData: (txt: string) => void, onDisc: () => void): {
    device: Monocle | undefined,
    connect: () => void
} {
    const [device, setDevice] = useState(undefined as Monocle | undefined);

    const connect = useCallback(async () => {
        await ensureConnected(onData, onDisc);

        if (isConnected()) {
            await replRawMode(true)
            await replSend(DEVICE_INIT + '\r');
            setDevice(DEVICE);
        } else {
            setDevice(undefined);
        }
    }, [onData, onDisc]);

    return {
        device,
        connect
    }
}

function formatStep(step: google.maps.DirectionsStep) {
    return step.instructions.replace(/<\/?[^>]+(>|$)/g, "");
}

function WaitForDevice({nav}: { nav: google.maps.DirectionsResult }) {
    const [pos, setPos] = useState(0);
    const [text, setText] = useState("Navigating")

    const back = useCallback(() => {
        setPos((pos) => Math.max(0, pos - 1))
    }, [setPos])

    const next = useCallback(() => {
        setPos((pos) => Math.min(nav.routes[0].legs[0].steps.length - 1, pos + 1))
    }, [setPos])

    const onData = useCallback((txt: string) => {
        console.log("FROM: ", pos, " TO ", nav.routes[0].legs[0].steps.length - 1);
        if (txt.includes('B')) {
            back();
        } else if (txt.includes('A')) {
            next()
        } else {
            throw "Unhandled button" + txt
        }
    }, [back, next]);

    const onDisc = useCallback(() => {

    }, []);

    const {device, connect} = useMonocle(onData, onDisc)

    useAsyncEffect(async () => {
        device ? await device.showText(text) : null;
    }, [text]);

    useEffect(() => {
        setText(formatStep(nav.routes[0].legs[0].steps[pos]));
    }, [pos])

    return !device ? <button onClick={connect}>Connect Monocle</button> : (<div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2vh',
        alignItems: 'center'
    }}>
        <div>Navigate from {nav.routes[0].legs[0].start_address} to {nav.routes[0].legs[0].end_address}</div>
        <div>Total time: {nav.routes[0].legs[0].duration.text}</div>
        <div>Directions: {text}</div>
        <div style={{display: "flex", flexDirection: "row", justifyContent: "space-evenly"}}>
            <button onClick={back}>Back</button>
            <button onClick={next}>Next</button>
        </div>
    </div>)
}

function NavigateTo({position}: { position: GeolocationPosition }) {

    const [navigation, setNavigation] = useState(undefined as undefined | google.maps.DirectionsResult)

    const {ref} = usePlacesWidget<HTMLInputElement>({
        onPlaceSelected: async (place) => {
            const {DirectionsService} = await google.maps.importLibrary("routes") as google.maps.RoutesLibrary
            const directionsService = new DirectionsService();
            const routed = await directionsService.route({
                origin: {
                    location: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }
                },
                destination: place.geometry?.location as google.maps.LatLng,
                travelMode: google.maps.TravelMode.WALKING
            });
            console.log(routed);

            setNavigation(routed);
        },
        options: {
            types: ['geocode']
        }
    })

    return !navigation
        ? (<div>
            <div>Navigate to</div>
            <input ref={ref}/>
        </div>)
        : (<div>
            <WaitForDevice nav={navigation}/>
        </div>)
}

function NavigateFrom() {
    const position = useCurrentLocation();

    return !position ? <div>Trying to locate you</div> : (
        <NavigateTo position={position as GeolocationPosition}/>);
}


function WaitForLoader() {
    const {isLoaded, loadError} = useJsApiLoader({
        googleMapsApiKey: 'AIzaSyBORwh6GHvN5mdNa0DbbzFSFKLaZIlp4vQ',
        version: 'weekly',
        libraries: LIBRARIES,
    })

    console.log(loadError)
    return isLoaded
        ? (<NavigateFrom/>)
        : loadError
            ? <div>Load error {loadError.message}</div>
            : <div>Loading google maps</div>
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<WaitForLoader/>)
