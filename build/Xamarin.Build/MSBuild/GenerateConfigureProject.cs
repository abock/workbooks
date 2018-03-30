// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

using Microsoft.Build.Evaluation;
using Microsoft.Build.Framework;
using Microsoft.Build.Utilities;

namespace Xamarin.MSBuild
{
    public sealed class GenerateConfigureProject : Task
    {
        static readonly char [] profileNameDelimiters = { '+', '|', ';', ',', '-', '\\', '/' };

        [Required]
        public string InputFile { get; set; }

        [Required]
        public string OutputFile { get; set; }

        public ITaskItem [] OverrideProperties { get; set; }

        public override bool Execute ()
        {
            InputFile = Path.Combine (Path.GetDirectoryName (BuildEngine5.ProjectFileOfTaskNode), InputFile);
            OutputFile = Path.Combine (Path.GetDirectoryName (BuildEngine5.ProjectFileOfTaskNode), OutputFile);

            var summary = new List<(int depth, string text)> ();

            var inputProject = new ProjectCollection ().LoadProject (InputFile);

            var projectCollection = new ProjectCollection ();
            var outputProject = new Project (projectCollection, NewProjectFileOptions.None);

            foreach (var property in inputProject.AllEvaluatedProperties) {
                if (!property.IsReservedProperty && !property.IsEnvironmentProperty)
                    outputProject.SetProperty (property.Name, property.EvaluatedValue);
            }

            foreach (var property in OverrideProperties ?? Array.Empty<ITaskItem> ())
                outputProject.SetProperty (property.ItemSpec, property.GetMetadata ("Value"));

            var profileProperty = outputProject.GetProperty ("Profile");
            if (profileProperty != null)
                outputProject.RemoveProperty (profileProperty);

            summary.Add ((0, "Configuration:"));
            foreach (var property in outputProject.Properties) {
                if (!property.IsReservedProperty &&
                    !property.IsEnvironmentProperty &&
                    !Path.IsPathRooted (property.EvaluatedValue))
                    summary.Add ((1, $"{property.Name}: {property.EvaluatedValue}"));
            }

            foreach (var item in inputProject.AllEvaluatedItems)
                outputProject.AddItemFast (
                    item.ItemType,
                    item.EvaluatedInclude,
                    item.Metadata.ToDictionary (m => m.Name, m => m.EvaluatedValue));

            if (profileProperty != null) {
                summary.Add ((0, "Selected Profiles:"));
                outputProject.RemoveItems (outputProject.GetItems ("ProfileTargets"));

                var profileNames = profileProperty
                    .EvaluatedValue
                    .Split (profileNameDelimiters, StringSplitOptions.RemoveEmptyEntries)
                    .Select (name => {
                        name = name.Trim ();
                        if (name.EndsWith ("profile", StringComparison.OrdinalIgnoreCase))
                            name = name.Substring (0, name.Length - 7);
                        return name;
                    })
                    .ToArray ();

                foreach (var profileName in profileNames) {
                    summary.Add ((1, profileName));
                    outputProject.AddItemFast (
                        "ProfileTargets",
                        profileName + "Profile",
                        new Dictionary<string, string> { ["Name"] = profileName });
                }
            }

            foreach (var summaryLine in summary)
                outputProject.AddItemFast (
                    "ConfigurationSummary",
                    string.Join ("", Enumerable.Repeat ("%20", summaryLine.depth * 2)) + summaryLine.text);

            outputProject.Save (OutputFile, Encoding.UTF8);

            return true;
        }
    }
}