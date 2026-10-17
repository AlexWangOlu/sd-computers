import { useEffect, useState } from 'react';
import { IoCloudySharp, IoPartlySunny, IoSunny, IoRainy, IoThunderstorm } from 'react-icons/io5';
import {
  BsFillMoonStarsFill,
  BsFillSunsetFill,
  BsFillSunriseFill,
  BsFillCloudMoonFill,
  BsCloudDrizzleFill,
  BsCloudLightningFill,
  BsCloudLightningRainFill,
} from 'react-icons/bs';
import { FaCloudSunRain, FaCloudMoonRain } from 'react-icons/fa6';
import { cn } from '../utils';
import { useMacOS } from '../compat';

interface CurrentWeather {
  temp: number;
  weather_code: number;
  is_day: number;
  high: number;
  low: number;
}

interface HourSlot {
  time: Date;
  temp: number;
  code: number;
  is_day: number;
  isSunset?: boolean;
  isSunrise?: boolean;
}

const WeatherGlyph = ({
  code,
  isDay,
  size = 22,
  sunset,
  sunrise,
}: {
  code: number;
  isDay: number;
  size?: number;
  sunset?: boolean;
  sunrise?: boolean;
}) => {
  const style = { color: '#ffffff' };
  const props = { size, style };

  if (sunrise) return <BsFillSunriseFill {...props} />;
  if (sunset) return <BsFillSunsetFill {...props} />;
  if (code === 0) return isDay ? <IoSunny {...props} /> : <BsFillMoonStarsFill {...props} />;
  if (code <= 2) return isDay ? <IoPartlySunny {...props} /> : <BsFillCloudMoonFill {...props} />;
  if (code === 3 || code <= 49) return <IoCloudySharp {...props} />;
  if (code <= 57) return <BsCloudDrizzleFill {...props} />;
  if (code <= 67 || (code >= 80 && code <= 82)) return isDay ? <FaCloudSunRain {...props} /> : <FaCloudMoonRain {...props} />;
  if (code === 95) return <IoThunderstorm {...props} />;
  if (code === 96 || code === 99) return <BsCloudLightningRainFill {...props} />;
  if (code <= 99) return <BsCloudLightningFill {...props} />;
  return <IoRainy {...props} />;
};

// Los Santos weather, drawn locally: a calm, warm coast day with a few clouds in the afternoon.
// The reference widget fetched open-meteo.com; a FiveM resource must not reach outside the server,
// so the same card is fed from the clock instead of the internet.
const DAY_CODES = [1, 1, 0, 0, 0, 1, 2, 2, 3, 2, 1, 1, 0, 0, 0, 1, 2, 3, 2, 1, 0, 0, 1, 1];
const SUNRISE_H = 6;
const SUNSET_H = 19.5;

const codeFor = (hour: number): number => DAY_CODES[hour % DAY_CODES.length];
const isDayAt = (hour: number): number => (hour >= SUNRISE_H && hour + 0.5 < SUNSET_H ? 1 : 0);
const tempFor = (hour: number): number => Math.round(23 + 6 * Math.sin(((hour - 7) / 24) * Math.PI * 2));

export const LosSantosWeatherWidget = ({ className }: { className?: string }) => {
  const { language, t } = useMacOS();
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [hours, setHours] = useState<HourSlot[]>([]);

  useEffect(() => {
    const build = () => {
      const now = new Date();
      setCurrent({
        temp: tempFor(now.getHours() + now.getMinutes() / 60),
        weather_code: codeFor(now.getHours()),
        is_day: isDayAt(now.getHours()),
        high: 30,
        low: 18,
      });

      const slots: HourSlot[] = [];
      for (let i = 0; i < 6; i++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + i, 0, 0);
        const h = at.getHours();
        slots.push({ time: at, temp: tempFor(h), code: codeFor(h), is_day: isDayAt(h) });
      }

      // Today's sunset / tomorrow's sunrise, if they fall inside the six-hour strip
      const at = (hour: number, dayOffset: number) =>
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, Math.floor(hour), Math.round((hour % 1) * 60), 0);
      for (const [when, marker] of [
        [at(SUNSET_H, 0), { isSunset: true }],
        [at(SUNRISE_H, 1), { isSunrise: true }],
      ] as const) {
        if (when < slots[0].time || when > slots[slots.length - 1].time) continue;
        const idx = Math.max(0, Math.min(slots.length - 1, Math.round((when.getTime() - slots[0].time.getTime()) / 3.6e6)));
        slots.splice(idx, 0, { time: when, temp: 0, code: 0, is_day: 1, ...marker });
      }
      setHours(slots.slice(0, 6));
    };

    build();
    const timer = window.setInterval(build, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const conditionLabel = (code: number, isDay: number) => {
    if (code === 0) return isDay ? t.weather.sunny : t.weather.clear;
    if (code <= 2) return t.weather.partlyCloudy;
    if (code === 3) return t.weather.cloudy;
    if (code <= 49) return t.weather.foggy;
    if (code <= 57) return t.weather.drizzle;
    if (code <= 67) return t.weather.rain;
    if (code <= 77) return t.weather.snow;
    if (code <= 82) return t.weather.showers;
    if (code <= 86) return t.weather.snowShowers;
    return t.weather.thunderstorm;
  };

  return (
    <div className={cn('rounded-3xl overflow-hidden liquid-glass-card text-white', className)} style={{ width: 356 }}>
      <div className="px-4 pt-3 pb-2.5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[14px]" style={{ fontWeight: 500, letterSpacing: '0.01em' }}>
              {t.weather.city}
            </div>

            <div className="leading-none mt-1" style={{ fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em' }}>
              {current ? `${current.temp}°` : '—'}
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-0.5">
            {current && <WeatherGlyph code={current.weather_code} isDay={current.is_day} size={22} />}

            {current && (
              <>
                <div className="text-[13px]" style={{ fontWeight: 400, letterSpacing: '0.01em' }}>
                  {conditionLabel(current.weather_code, current.is_day)}
                </div>

                <div className="text-[12px] text-white/75" style={{ fontWeight: 300 }}>
                  {t.weather.high}:{current.high}° {t.weather.low}:{current.low}°
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 mt-2">
          {hours.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="text-[11px] text-white/80" style={{ fontWeight: 400 }}>
                {new Intl.DateTimeFormat(language, {
                  hour: 'numeric',
                  minute: h.isSunset || h.isSunrise ? '2-digit' : undefined,
                }).format(h.time)}
              </div>

              <WeatherGlyph code={h.code} isDay={h.is_day} size={20} sunset={h.isSunset} sunrise={h.isSunrise} />

              {!h.isSunset && !h.isSunrise ? (
                <div className="text-[13px]" style={{ fontWeight: 500 }}>
                  {h.temp}°
                </div>
              ) : (
                <div className="text-[11px] text-white/75" style={{ fontWeight: 400 }}>
                  {h.isSunset ? t.weather.sunset : t.weather.sunrise}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
