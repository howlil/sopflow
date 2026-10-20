# Private SOP-TA compatibility integration

This package is part of the SOPFlow monorepo but **is not published to npm**. It owns legacy `sop-ta` DTO conversion, lossless export guards and strict import diagnostics; generic SOP flow and rendering packages must not depend on it. The historical `@sopflow/adapter-sop-ta` npm package remains installable at its last published version, but this integration receives new fixes only inside the repository.
