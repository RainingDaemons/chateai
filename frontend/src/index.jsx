/* @refresh reload */
import { render } from 'solid-js/web';
import { Provider } from './helpers/Provider';
import Main from './app/Main';

import './styles/index.css';

const root = document.getElementById('root');

render(() => (
    <Provider>
        <Main />
    </Provider>
), root);
