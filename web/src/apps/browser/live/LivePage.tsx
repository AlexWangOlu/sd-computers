import type { LiveProps } from './parts';
import News from './News';
import Board from './Board';
import Directory from './Directory';
import SquawkSite from './Squawk';
import Laws from './Laws';
import Stocks from './Stocks';

/**
 * A live site's page: one of sd-phone's public apps, read from the phone as it is opened
 * (server/computers/web.lua). Which site it is the network says (`live` on its entry in
 * configs/shared/browser.lua); which of its pages, the rest of the address.
 */
export default function LivePage(props: LiveProps) {
  switch (props.live) {
    case 'news':
      return <News {...props} />;
    case 'market':
      return <Board {...props} kind="market" />;
    case 'pages':
      return <Board {...props} kind="pages" />;
    case 'directory':
      return <Directory {...props} />;
    case 'squawk':
      return <SquawkSite {...props} />;
    case 'laws':
      return <Laws {...props} />;
    case 'stocks':
      return <Stocks {...props} />;
  }
}
