﻿//
// Author:
//   Aaron Bockover <abock@microsoft.com>
//
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Newtonsoft.Json;

namespace Xamarin.Interactive.CodeAnalysis
{
    /// <summary>
    /// Represents a 1-based position in a buffer.
    /// </summary>
    public struct Position
    {
        public int LineNumber { get; }
        public int Column { get; }

        [JsonConstructor]
        public Position (
            int lineNumber,
            int column)
        {
            LineNumber = lineNumber;
            Column = column;
        }
    }
}