// @unocss-include
import { getColorPalette, getRgb } from '@sa/color';
import { DARK_CLASS } from '@/constants/app';
import { toggleHtmlClass } from '@/utils/common';
import { localStg } from '@/utils/storage';
import { $t } from '@/locales';

export function setupLoading() {
  const themeColor = localStg.get('themeColor') || '#646cff';
  const darkMode = localStg.get('darkMode') || false;
  const palette = getColorPalette(themeColor);

  const { r, g, b } = getRgb(themeColor);

  const primaryColor = `--primary-color: ${r} ${g} ${b}`;

  const svgCssVars = Array.from(palette.entries())
    .map(([key, value]) => `--logo-color-${key}: ${value}`)
    .join(';');

  const cssVars = `${primaryColor}; ${svgCssVars}`;

  if (darkMode) {
    toggleHtmlClass(DARK_CLASS).add();
  }

  const loadingClasses = [
    'left-0 top-0',
    'left-0 bottom-0 animate-delay-500',
    'right-0 top-0 animate-delay-1000',
    'right-0 bottom-0 animate-delay-1500'
  ];

  const dot = loadingClasses
    .map(item => {
      return `<div class="absolute w-16px h-16px bg-primary rounded-8px animate-pulse ${item}"></div>`;
    })
    .join('\n');

  const loading = `
<div class="fixed-center flex-col bg-layout" style="${cssVars}">
  <div class="w-128px h-128px">
    ${getLogoSvg()}
  </div>
  <div class="w-56px h-56px my-36px">
    <div class="relative h-full animate-spin">
      ${dot}
    </div>
  </div>
  <h2 class="text-28px font-500 text-primary">${$t('system.title')}</h2>
</div>`;

  const app = document.getElementById('app');

  if (app) {
    app.innerHTML = loading;
  }
}

function getLogoSvg() {
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 360 347" version="1.1">
    <defs>
        <linearGradient x1="-7.10542736e-13%" y1="47.8169004%" x2="100%" y2="51.6876733%" id="hsgGradientPurple">
            <stop stop-color="#FFFFFF" stop-opacity="0" offset="0%"></stop>
            <stop stop-color="#F8F6F9" offset="2.38030863%"></stop>
            <stop stop-color="#DDDAE7" offset="6.04940878%"></stop>
            <stop stop-color="#9890B6" offset="14.1990161%"></stop>
            <stop stop-color="#72679A" offset="23.1509238%"></stop>
            <stop stop-color="#382871" offset="36.6162561%"></stop>
            <stop stop-color="#2F1F6B" offset="77.6868666%"></stop>
            <stop stop-color="#3A2B73" offset="100%"></stop>
        </linearGradient>
        <linearGradient x1="8.05721549%" y1="94.4812738%" x2="97.1431379%" y2="6.23850977%" id="hsgGradientBlue">
            <stop stop-color="#60A4CB" offset="0%"></stop>
            <stop stop-color="#5BA1CA" offset="49.1603691%"></stop>
            <stop stop-color="#98C4DE" offset="77.6868666%"></stop>
            <stop stop-color="#D3E5F1" offset="89.0783361%"></stop>
            <stop stop-color="#FFFFFF" stop-opacity="0.8" offset="100%"></stop>
        </linearGradient>
    </defs>
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g>
            <path d="M177.511291,225.319766 C97.0781237,225.319766 31.8707555,198.731178 31.8707555,165.932364 C31.8707555,133.133549 97.0781237,106.544961 177.511291,106.544961 C257.944458,106.544961 323.151826,133.133549 323.151826,165.932364 C323.151826,198.731178 257.944458,225.319766 177.511291,225.319766 M178.925277,81.0932168 C96.9282412,81.0932168 30.4567697,119.078531 30.4567697,165.932364 C30.4567697,212.786196 96.9282412,250.77151 178.925277,250.77151 C260.922312,250.77151 327.393783,212.786196 327.393783,165.932364 C327.393783,119.078531 260.922312,81.0932168 178.925277,81.0932168" fill="url(#hsgGradientPurple)" transform="translate(178.925277, 165.932364) rotate(-405.000000) translate(-178.925277, -165.932364) "></path>
            <path d="M60.9442825,91.9442825 C118.924942,33.9636227 192.787044,13.8208676 225.917706,46.9515305 L225.148737,46.2002573 C224.542023,46.2924765 223.933395,46.3899469 223.322919,46.49265 C198.869026,25.976871 135.56286,53.3199063 79.9412222,108.941544 C23.0663843,165.816382 -4.24121661,230.725926 18.9510473,253.91819 C42.1433112,277.110454 107.052855,249.802853 163.927693,192.928015 C212.640687,144.215021 239.663656,89.6079025 231.844422,60.366329 C232.899563,60.0201767 233.947998,59.6921103 234.986808,59.3829165 C254.121471,96.2513354 232.482856,160.367053 180.924954,211.924954 C122.944295,269.905614 49.0821934,290.048369 15.9515305,256.917706 C-17.1791324,223.787044 2.96362274,149.924942 60.9442825,91.9442825 Z" fill="url(#hsgGradientBlue)" transform="translate(120.934444, 151.934618) rotate(-360.000000) translate(-120.934444, -151.934618) "></path>
        </g>
    </g>
</svg>
`;

  return logoSvg;
}
