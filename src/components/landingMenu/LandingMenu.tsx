import { Link } from '@tanstack/react-router';

const LandingMenu = () => {
  return (
    <nav className="flex justify-center">
      <ul className="flex items-center w-330 bg-transparent py-5">
        <li className="flex-grow">
          <Link to="/" className="px-20 py-10">
            Cambridge School of English
          </Link>
        </li>

        <li className="">
          <Link to="/about" className="px-20 py-5 [&.active]:font-bold">
            O szkole
          </Link>
        </li>
        <li className="">
          <Link to="/method" className="px-20 py-5 [&.active]:font-bold">
            Metody
          </Link>
        </li>
        <li className="">
          <Link to="/companies" className="px-20 py-5 [&.active]:font-bold">
            Dla firm
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default LandingMenu;
