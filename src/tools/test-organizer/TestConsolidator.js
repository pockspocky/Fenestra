/**
 * Test Consolidator
 * 
 * Analyzes duplicate test groups and generates consolidation plans
 * for merging duplicate tests while preserving comprehensive coverage.
 * 
 * The consolidator identifies:
 * - Tests with identical coverage that can be merged
 * - Tests with overlapping coverage that should be reviewed
 * - Tests that should remain separate despite similarities
 */

import fs from 'fs';
import path from 'path';

export class TestConsolidator {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
  }

  /**
   * Analyzes duplicate groups and generates consolidation plan
   * @param {TestCatalog} catalog - Test catalog from TestAnalyzer
   * @returns {Promise<ConsolidationPlan>}
   */
  async consolidate(catalog) {
    console.log('Analyzing duplicate test coverage...');
    
    const plan = {
      timestamp: new Date().toISOString(),
      totalDuplicates: catalog.duplicates.length,
      merges: [],
      reviews: [],
      keeps: [],
      summary: {
        filesToMerge: 0,
        filesToReview: 0,
        filesToKeep: 0,
        estimatedReduction: 0
      }
    };
    
    for (const duplicate of catalog.duplicates) {
      const action = await this.analyzeDuplicateGroup(duplicate, catalog);
      
      if (action.type === 'merge') {
        plan.merges.push(action);
        plan.summary.filesToMerge += action.sourceFiles.length;
      } else if (action.type === 'review') {
        plan.reviews.push(action);
        plan.summary.filesToReview += action.files.length;
      } else if (action.type === 'keep') {
        plan.keeps.push(action);
        plan.summary.filesToKeep += action.files.length;
      }
    }
    
    // Calculate estimated reduction
    plan.summary.estimatedReduction = plan.summary.filesToMerge - plan.merges.length;
    
    return plan;
  }

  /**
   * Analyzes a duplicate group and determines the best action
   * @param {DuplicateGroup} duplicate - Duplicate group
   * @param {TestCatalog} catalog - Full test catalog
   * @returns {Promise<ConsolidationAction>}
   */
  async analyzeDuplicateGroup(duplicate, catalog) {
    const files = duplicate.files.map(filePath => 
      catalog.files.find(f => f.path === filePath)
    ).filter(Boolean);
    
    if (files.length === 0) {
      return {
        type: 'keep',
        reason: 'No files found',
        files: duplicate.files
      };
    }
    
    // Check if all files are the same type
    const types = new Set(files.map(f => f.type));
    
    if (types.size === 1) {
      // Same type - check for merge opportunity
      const type = Array.from(types)[0];
      
      // Check coverage overlap
      const overlapScore = this.calculateCoverageOverlap(files);
      
      if (overlapScore > 0.8) {
        // High overlap - recommend merge
        return {
          type: 'merge',
          reason: `High coverage overlap (${Math.round(overlapScore * 100)}%) for ${type} tests`,
          sourceFiles: files.map(f => f.path),
          targetFile: this.selectMergeTarget(files),
          testType: type,
          overlapScore
        };
      } else if (overlapScore > 0.5) {
        // Medium overlap - needs review
        return {
          type: 'review',
          reason: `Medium coverage overlap (${Math.round(overlapScore * 100)}%) - manual review needed`,
          files: files.map(f => f.path),
          overlapScore
        };
      } else {
        // Low overlap - keep separate
        return {
          type: 'keep',
          reason: `Low coverage overlap (${Math.round(overlapScore * 100)}%) - tests cover different aspects`,
          files: files.map(f => f.path),
          overlapScore
        };
      }
    } else {
      // Different types - keep separate
      return {
        type: 'keep',
        reason: `Different test types: ${Array.from(types).join(', ')}`,
        files: files.map(f => f.path)
      };
    }
  }

  /**
   * Calculates coverage overlap between test files
   * @param {TestFile[]} files - Test files to compare
   * @returns {number} - Overlap score (0-1)
   */
  calculateCoverageOverlap(files) {
    if (files.length < 2) {
      return 0;
    }
    
    // Get all unique test descriptions
    const allCoverage = new Set();
    files.forEach(f => f.coverage.forEach(c => allCoverage.add(c)));
    
    if (allCoverage.size === 0) {
      return 0;
    }
    
    // Count how many tests appear in multiple files
    const coverageCount = new Map();
    files.forEach(file => {
      file.coverage.forEach(test => {
        coverageCount.set(test, (coverageCount.get(test) || 0) + 1);
      });
    });
    
    // Calculate overlap score
    let overlapCount = 0;
    for (const [test, count] of coverageCount.entries()) {
      if (count > 1) {
        overlapCount++;
      }
    }
    
    return overlapCount / allCoverage.size;
  }

  /**
   * Selects the best file to use as merge target
   * @param {TestFile[]} files - Files to merge
   * @returns {string} - Path to target file
   */
  selectMergeTarget(files) {
    // Prefer files with:
    // 1. More comprehensive coverage
    // 2. Better naming
    // 3. More recent (if we had timestamps)
    
    let bestFile = files[0];
    let bestScore = this.scoreMergeTarget(bestFile);
    
    for (let i = 1; i < files.length; i++) {
      const score = this.scoreMergeTarget(files[i]);
      if (score > bestScore) {
        bestScore = score;
        bestFile = files[i];
      }
    }
    
    return bestFile.path;
  }

  /**
   * Scores a file as a potential merge target
   * @param {TestFile} file - File to score
   * @returns {number} - Score (higher is better)
   */
  scoreMergeTarget(file) {
    let score = 0;
    
    // More tests is better
    score += file.testCount * 10;
    
    // More coverage is better
    score += file.coverage.length * 5;
    
    // Prefer files with feature/property info
    if (file.featureInfo && file.featureInfo.feature) {
      score += 20;
    }
    
    // Prefer files with better naming (contains type in name)
    if (file.name.includes('-unit') || file.name.includes('-integration') || file.name.includes('-property')) {
      score += 15;
    }
    
    // Prefer larger files (more comprehensive)
    score += Math.min(file.lines / 10, 50);
    
    return score;
  }

  /**
   * Generates merge instructions for a consolidation action
   * @param {ConsolidationAction} action - Merge action
   * @returns {Promise<MergeInstructions>}
   */
  async generateMergeInstructions(action) {
    if (action.type !== 'merge') {
      return null;
    }
    
    const instructions = {
      targetFile: action.targetFile,
      sourceFiles: action.sourceFiles.filter(f => f !== action.targetFile),
      steps: []
    };
    
    // Step 1: Read all files
    instructions.steps.push({
      step: 1,
      action: 'read',
      description: 'Read all source files and target file',
      files: action.sourceFiles
    });
    
    // Step 2: Extract unique tests
    instructions.steps.push({
      step: 2,
      action: 'extract',
      description: 'Extract unique tests from source files that are not in target',
      note: 'Preserve test descriptions, assertions, and comments'
    });
    
    // Step 3: Merge into target
    instructions.steps.push({
      step: 3,
      action: 'merge',
      description: 'Add unique tests to target file',
      targetFile: action.targetFile,
      note: 'Maintain consistent formatting and organization'
    });
    
    // Step 4: Update imports
    instructions.steps.push({
      step: 4,
      action: 'update-imports',
      description: 'Ensure all necessary imports are present in target file',
      note: 'Remove duplicate imports'
    });
    
    // Step 5: Verify
    instructions.steps.push({
      step: 5,
      action: 'verify',
      description: 'Run tests to ensure all functionality is preserved',
      command: 'node ' + action.targetFile
    });
    
    // Step 6: Delete source files
    instructions.steps.push({
      step: 6,
      action: 'delete',
      description: 'Delete source files after successful merge',
      files: instructions.sourceFiles,
      note: 'Only delete after verification passes'
    });
    
    return instructions;
  }

  /**
   * Exports consolidation plan to JSON
   * @param {ConsolidationPlan} plan - Consolidation plan
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async exportPlan(plan, outputPath) {
    const json = JSON.stringify(plan, null, 2);
    await fs.promises.writeFile(outputPath, json, 'utf-8');
    console.log(`Consolidation plan exported to ${outputPath}`);
  }

  /**
   * Exports consolidation plan to Markdown
   * @param {ConsolidationPlan} plan - Consolidation plan
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async exportMarkdown(plan, outputPath) {
    let md = '# Test Consolidation Plan\n\n';
    md += `Generated: ${plan.timestamp}\n\n`;
    
    md += '## Summary\n\n';
    md += `- Total duplicate groups: ${plan.totalDuplicates}\n`;
    md += `- Files to merge: ${plan.summary.filesToMerge}\n`;
    md += `- Files to review: ${plan.summary.filesToReview}\n`;
    md += `- Files to keep separate: ${plan.summary.filesToKeep}\n`;
    md += `- Estimated file reduction: ${plan.summary.estimatedReduction}\n\n`;
    
    if (plan.merges.length > 0) {
      md += '## Merge Actions\n\n';
      for (const merge of plan.merges) {
        md += `### Merge: ${merge.testType} tests\n\n`;
        md += `**Reason:** ${merge.reason}\n\n`;
        md += `**Target:** ${merge.targetFile}\n\n`;
        md += `**Source files:**\n`;
        for (const file of merge.sourceFiles) {
          if (file !== merge.targetFile) {
            md += `- ${file}\n`;
          }
        }
        md += '\n';
      }
    }
    
    if (plan.reviews.length > 0) {
      md += '## Manual Review Required\n\n';
      for (const review of plan.reviews) {
        md += `### Review: ${review.reason}\n\n`;
        md += `**Files:**\n`;
        for (const file of review.files) {
          md += `- ${file}\n`;
        }
        md += '\n';
      }
    }
    
    if (plan.keeps.length > 0) {
      md += '## Keep Separate\n\n';
      for (const keep of plan.keeps) {
        md += `### ${keep.reason}\n\n`;
        md += `**Files:**\n`;
        for (const file of keep.files) {
          md += `- ${file}\n`;
        }
        md += '\n';
      }
    }
    
    await fs.promises.writeFile(outputPath, md, 'utf-8');
    console.log(`Consolidation plan exported to ${outputPath}`);
  }
}
