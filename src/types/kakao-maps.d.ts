/**
 * 카카오맵 JavaScript API 최소 타입 선언
 * (공식 @types 패키지가 없어 프로젝트에서 사용하는 범위만 선언)
 */
declare global {
  interface Window {
    kakao: typeof kakao;
  }

  namespace kakao.maps {
    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng;
      setLevel(level: number): void;
      getLevel(): number;
      panTo(latlng: LatLng): void;
    }

    interface MapOptions {
      center: LatLng;
      level?: number;
    }

    class CustomOverlay {
      constructor(options: CustomOverlayOptions);
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng): void;
      getPosition(): LatLng;
    }

    interface CustomOverlayOptions {
      position: LatLng;
      content: string | HTMLElement;
      map?: Map;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
      clickable?: boolean;
    }

    namespace event {
      function addListener(
        target: unknown,
        type: string,
        handler: (...args: unknown[]) => void,
      ): void;
      function removeListener(
        target: unknown,
        type: string,
        handler: (...args: unknown[]) => void,
      ): void;
    }

    function load(callback: () => void): void;
  }
}

export {};
