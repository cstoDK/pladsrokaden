import { render } from 'preact';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-ext-400.css';
import '@fontsource/atkinson-hyperlegible/latin-ext-700.css';
import './styles.css';
import { bedOmVedvarendeLager } from './app/lager';
import { App } from './ui/App';

bedOmVedvarendeLager();
render(<App />, document.getElementById('app')!);
