# Casper Wallet Playground App

![Screenshot of the Casper Wallet Playground App in action](doc/img/casper-wallet-playground.png)

## Introduction

Casper Wallet Playground App is a sample project designed to help developers understand how to integrate [CSPR.click](https://docs.cspr.click) with third-party web applications, using Casper Wallet, Ledger, MetaMask Snap, or Google sign-in. This repository serves as a reference implementation and learning resource for developers interested in the Casper Network ecosystem.

Please be aware that the app is only for development and testing, and not for direct usage in production environments, as the name suggests.

## Getting Started

To set up the development environment, follow these steps:

1. Prerequisites: Ensure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
2. Clone the repository: `git clone https://github.com/make-software/casper-wallet-playground.git`
3. Navigate to the project directory: `cd casper-wallet-playground`
4. Install dependencies: `npm install`

Once the setup is complete, refer to the [Available Scripts](#available-scripts) section to start, test, or build the project.

## CSPR.click integration

The wallet service loads the CSPR.click 2.2.0 UI bundle dynamically, following the
`csprclick-x402` reference integration. SDK options are assigned before download;
wallet methods are available only after `csprclick:loaded`. The UI container lives
outside React's root so React does not remove SDK-managed elements.

Click **Connect** to choose a provider. **Switch** opens the SDK account chooser,
which also allows changing providers. **Sign out** ends the CSPR.click session;
**Disconnect wallet** revokes the active provider's connection permission.
Account changes and restored sessions come from CSPR.click, without a separate
public-key cache in the playground.

Deploy, Transaction V1, message, EIP-712, encryption and decryption scenarios all
use the SDK. Provider capabilities vary; **Get Active Key Supports** reports the
active provider's capabilities, and unsupported requests show the SDK error.
Signing and encryption keys must match the active account. Scenarios specifying
another key therefore fail at the SDK integration boundary. Transactions are
signed for inspection only; these scenarios do not submit them to the network.

Optional configuration in `.env.local` (restart the development server after edits):

```dotenv
REACT_APP_CSPRCLICK_APP_ID=csprclick-template
# Optional service override for a development CSPR.click environment:
# REACT_APP_CSPRCLICK_HOST=https://your-csprclick-host.example
# Optional SDK bundle override (default matches csprclick-x402's RC UI bundle):
# REACT_APP_CSPRCLICK_SCRIPT_URL=https://cdn.cspr.click/rc-ui/v2.2.0/csprclick-client-2.2.0.js
```

`csprclick-template` is for localhost development. Before deploying to a hosted
environment, register an application at [CSPR.build](https://console.cspr.build)
and set its application ID. The reference project's private development host is
not required; the playground uses the SDK's default service unless overridden.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Contributing

We welcome contributions from the community! If you'd like to contribute, please follow these guidelines:

1. Fork the repository and create a new branch for your feature or bug fix.
2. Commit your changes and submit a pull request to the original repository.
3. For issues, bug reports, or feature requests, please create a new issue in the [issue tracker](https://github.com/make-software/casper-wallet-playground/issues).

Before submitting a pull request, ensure you have:

- Followed the project's coding style and conventions.
- Added or updated relevant documentation.
- Included tests for new or updated functionality.

For more details on the contribution process, please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## License

This project is licensed under the Apache License 2.0. For more information, see the [LICENSE](LICENSE) file.
